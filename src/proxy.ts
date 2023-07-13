import models from './models';
import { Configuration, CreateChatCompletionRequest, CreateChatCompletionResponse, Model, OpenAIApi } from 'openai';

const modelMap: { [key: string]: Model } = models.data.reduce((map, model) => {
	map[model.id] = model;
	return map;
}, {});

async function handleOpenAIRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);
	url.hostname = 'api.openai.com';

	const openaiRequest = new Request(url.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
	});

	const response = await fetch(openaiRequest);

	// If the response is streamed, return it directly
	if (response.headers.get('Content-Type') === 'text/event-stream') {
		return response;
	}

	// If the response is not streamed, read it as JSON and return a new Response object
	const responseBody = await response.json();
	return new Response(JSON.stringify(responseBody), {
		status: response.status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function* generateStreamedResponse(modelNames: string[], request: Request) {
	for (const modelName of modelNames) {
		const model = modelMap[modelName];
		if (model.owned_by === 'openai') {
			const response = await handleOpenAIRequest(request);
			const reader = response.body?.getReader();
			while (true) {
				const { done, value } = await reader?.read();
				if (done) break;
				yield value;
			}
		}
		// TODO: handle other model owners
	}
}

async function handleMultipleModels(request: Request) {
	// Extract the model name from the POST body
	const body: CreateChatCompletionRequest = await request.json();
	const modelNames = body.model.split(',');

	if (body.stream) {
		const readableStream = new ReadableStream({
			start(controller) {
				(async () => {
					for await (const chunk of generateStreamedResponse(modelNames, request)) {
						controller.enqueue(chunk);
					}
					controller.close();
				})();
			},
		});
		return new Response(readableStream);
	} else {
		const responses = [];
		for (const modelName of modelNames) {
			const model = modelMap[modelName];
			if (model.owned_by === 'openai') {
				const response = await handleOpenAIRequest(request);
				responses.push(await response.json());
			}
			// TODO: handle other model owners
		}
		return new Response(JSON.stringify(responses), { headers: { 'Content-Type': 'application/json' } });
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Extract the model name from the POST body
		const body: CreateChatCompletionRequest = await request.json();
		const modelNames = body.model.split(',');

		const responses = await Promise.all(
			modelNames.map(async (modelName) => {
				const model = modelMap[modelName];
				// Validate if the model is available
				if (!model) {
					return {
						error: {
							message: `The model: \`${modelName}\` does not exist`,
							type: 'invalid_request_error',
							param: null,
							code: 'model_not_found',
						},
					};
				}

				//   1. handle openai
				if (model.owned_by === 'openai') {
					const response = await handleOpenAIRequest(request);
					const responseBody = await response.json();
					return responseBody;
				}

				// TODO: Handle other model owners
				//   2. handle azure openai
				//   3. handle claude
				//   4. handle palm
			})
		);
		// Finally concat all models response and return Response openai sdk likes

		return new Response(JSON.stringify(responses), { headers: { 'Content-Type': 'application/json' } });
	},
};
