import { CreateChatCompletionRequest } from 'openai';
import { Env } from './proxy';

// Define the Service interface
export interface AIService {
	fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response>;
}

export class OpenAIService implements AIService {
	async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response> {
		const url = new URL(request.url);
		url.protocol = 'https';
		url.hostname = 'api.openai.com';
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
}

export class AzureOpenAIService implements AIService {
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
}
