import { CreateChatCompletionRequest } from 'openai';
import { Env } from './proxy';

// Define the Service interface
export interface ServiceProvicder {
	fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response>;
	pipeStream(
		request: Request,
		env: Env,
		requestBody: CreateChatCompletionRequest,
		modelId: string,
		writer: WritableStreamDefaultWriter
	): any;
}

export class OpenAIService implements ServiceProvicder {
	async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response> {
		const url = new URL(request.url);
		url.protocol = 'https';
		// url.hostname = 'api.openai.com';
		url.hostname = 'oai.cheatshit.com';
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

		return await fetch(openaiRequest);
	}

	async pipeStream(
		request: Request,
		env: Env,
		requestBody: CreateChatCompletionRequest,
		modelId: string,
		writer: WritableStreamDefaultWriter
	) {
		const response = await this.fetch(request, env, requestBody, modelId);
		const reader = response?.body?.getReader();
		while (true && reader != null) {
			const { value, done } = await reader.read();
			if (done) {
				break;
			}
			// console.log(value);
			writer.write(value);
		}
	}
}

export class AzureOpenAIService implements ServiceProvicder {
	async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response> {
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

		return await fetch(azureRequest);
	}

	async pipeStream(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string, writer: WritableStream) {
		this.fetch(request, env, requestBody, modelId).then((response) => {
			const reader = response.body?.getReader();
			if (reader) {
			}
		});
	}
}
