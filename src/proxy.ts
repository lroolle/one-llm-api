import models from './models';
import { Configuration, CreateChatCompletionRequest, CreateChatCompletionResponse, Model, OpenAIApi } from 'openai';

const modelMap: { [key: string]: Model } = models.data.reduce((map, model) => {
	map[model.id] = model;
	return map;
}, {});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return handleMultipleModels(request, env);
	},
};

async function* handleStreamGenerator(readableStreams: ReadableStream[]) {
	for (const readable of readableStreams) {
		const reader = readable.getReader();
		while (true) {
			const { value, done } = await reader.read();
			if (done) {
				break;
			}
			yield value;
		}
	}
}

async function* handleStream(stream: ReadableStream) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}
		// Convert the chunk to a string and add it to the buffer
		buffer += decoder.decode(value, { stream: true });
		// Check if the buffer contains a complete JSON object
		let endOfObjectIndex = buffer.lastIndexOf('\n');
		if (endOfObjectIndex !== -1) {
			// If it does, yield the JSON string
			const jsonStr = buffer.slice(0, endOfObjectIndex);
			if (jsonStr.startsWith('data: ') && !jsonStr.includes('stop') && !jsonStr.includes('[DONE]')) {
				yield encoder.encode(jsonStr + '\n');
			}

			buffer = buffer.slice(endOfObjectIndex + 1);
		}
	}

	if (buffer.length > 0) {
		yield encoder.encode(buffer);
	}
}

async function handleMultipleModels(request: Request, env: Env) {
	// Extract the model name from the POST body
	const requestBody: CreateChatCompletionRequest = await request.json();
	const modelNames = requestBody.model.split(',');
	const requestStream = requestBody.stream || false;

	if (requestStream) {
		// Create a new TransformStream
		let { readable, writable } = new TransformStream();
		const writer = writable.getWriter();

		for (const modelName of modelNames) {
			const model = modelMap[modelName];
			switch (model.owned_by) {
				case 'openai':
					const responseOpenai = await handleOpenAIRequest(request, env, requestBody, model.id);
					for await (const value of handleStream(responseOpenai.body)) {
						// console.log('openai: ', value);
						await writer.write(value);
					}
					break;
				case 'azure-openai':
					const responseAzure = await handleAzureRequest(request, env, requestBody, model.id);
					for await (const value of handleStream(responseAzure.body)) {
						// console.log('azure: ', value);
						await writer.write(value);
					}
					break;
				case 'claude':
					console.log('Claude');
					break;
				case 'palm':
					console.log('Palm');
					break;
				default:
					continue;
			}
		}

		const encoder = new TextEncoder();
		await writer.write(encoder.encode('\n'));
		await writer.close();

		// Return a new Response with the TransformStream's readable side
		return new Response(readable, {
			headers: { 'Content-Type': 'text/event-stream' },
		});
	} else {
		let response;
		for (const modelName of modelNames) {
			const model = modelMap[modelName];
			switch (model.owned_by) {
				case 'openai':
					response = await handleOpenAIRequest(request, env, requestBody, model.id);
					break;
				case 'azure-openai':
					response = await handleAzureRequest(request, env, requestBody, model.id);
					break;
				case 'claude':
					console.log('Claude');
					break;
				case 'palm':
					console.log('Palm');
					break;
				default:
					continue;
			}
		}
		return response;
	}
}

async function handleAzureRequest(
	request: Request,
	env: Env,
	requestBody: CreateChatCompletionRequest,
	modelId: string
): Promise<Response> {
	const url = new URL(request.url);
	url.protocol = 'https';
	url.hostname = `${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`;
	url.port = '';
	url.pathname = `/openai/deployments/${modelId}/chat/completions`;
	url.searchParams.set('api-version', env.AZURE_OPENAI_API_VERSION || '2023-06-01-preview');

	requestBody.model = modelId;
	const azureRequest = new Request(url.toString(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-key': env.AZURE_OPENAI_API_KEY,
		},
		body: JSON.stringify(requestBody),
	});

	let response = await fetch(azureRequest);

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

async function handleOpenAIRequest(
	request: Request,
	env: Env,
	requestBody: CreateChatCompletionRequest,
	modelId: string
): Promise<Response> {
	const url = new URL(request.url);
	url.protocol = 'https';
	url.hostname = 'api.openai.com';
	url.hostname = 'oait.cheatshit.com';
	url.port = '';

	requestBody.model = modelId;
	const openaiRequest = new Request(url.toString(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify(requestBody),
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
