import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, CreateChatCompletionRequest } from 'openai';
import { fetchAllModels, getAvailableProviders, Model, providerServiceMap, getModelFromKV } from './services';
import { Env } from './worker';

// To handle multiple streams, we my need to remove some stop signals?
async function* handleStreamStop(stream: ReadableStream): AsyncGenerator<[Uint8Array, string | null]> {
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
			const messageData = buffer.slice(0, endOfObjectIndex);
			if (messageData.startsWith('data: ')) {
				let stopMsg = null;
				if (messageData.includes('"finish_reason":"stop"')) {
					stopMsg = messageData;
				} else if (messageData.includes('[DONE]')) {
					stopMsg = messageData;
				}
				yield [encoder.encode(messageData + '\n'), stopMsg];
			}

			buffer = buffer.slice(endOfObjectIndex + 1);
		}
	}

	if (buffer.length > 0) {
		yield [encoder.encode(buffer), null];
	}
}

function messagesToClaudePrompt(messages: Array<ChatCompletionRequestMessage>): string {
	let prompt = '';
	for (const message of messages) {
		switch (message.role) {
			case ChatCompletionRequestMessageRoleEnum.System || ChatCompletionRequestMessageRoleEnum.User:
				prompt += `\n\nHuman: ${message.content}`;
				break;
			case ChatCompletionRequestMessageRoleEnum.Assistant:
				prompt += `\n\nAssistant: ${message.content}`;
				break;
			case ChatCompletionRequestMessageRoleEnum.Function:
				// ??
				prompt += `\n\nFunction: ${message.content}`;
			default:
				prompt += `\n\nHuman: ${message.content}`;
				break;
		}
	}
	prompt += '\n\nAssistant:';
	return prompt;
}

const claudeMaxTokens = 100000;

function toClaudeRequestBody(requestBody: CreateChatCompletionRequest, modelId: string) {
	const prompt = messagesToClaudePrompt(requestBody.messages);
	const claudeRequestBody = {
		prompt: prompt,
		model: modelId,
		temperature: requestBody.temperature,
		max_tokens_to_sample: requestBody.max_tokens || claudeMaxTokens,
		stop_sequences: requestBody.stop,
		stream: requestBody.stream,
	};

	return claudeRequestBody;
}

function generateRandomId() {
	const buffer = new Uint8Array(18); // Create a buffer with 18 bytes
	crypto.getRandomValues(buffer); // Fill the buffer with random bytes
	let base64Id = btoa(String.fromCharCode.apply(null, buffer)); // Convert the buffer to a base64 string
	base64Id = base64Id.replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, ''); // Convert the base64 string to base64url
	return 'chatcmpl-' + base64Id;
}

const stopReasonMap = {
	stop_sequence: 'stop',
	max_tokens: 'length',
};

function claudeToOpenAIResponse(claudeResponse, modelId, messageId, stream = false) {
	const completion = claudeResponse['completion'];
	const timestamp = Math.floor(Date.now() / 1000);
	const completionTokens = completion.split(' ').length;
	const result = {
		id: messageId,
		created: timestamp,
		model: modelId,
		usage: {
			prompt_tokens: 0,
			completion_tokens: completionTokens,
			total_tokens: completionTokens,
		},
		choices: [
			{
				index: 0,
				finish_reason: claudeResponse['stop_reason'] ? stopReasonMap[claudeResponse['stop_reason']] : null,
			},
		],
	};
	const message = {
		role: 'assistant',
		content: completion,
	};
	if (!stream) {
		result.object = 'chat.completion';
		result.choices[0].message = message;
	} else {
		result.object = 'chat.completion.chunk';
		result.choices[0].delta = message;
	}
	return result;
}

async function* handleClaudeStream(stream: ReadableStream, modelId: string) {
	const reader = stream.getReader();

	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	const messageId = generateRandomId();

	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			yield encoder.encode('data: [DONE]');
			break;
		}
		const currentText = decoder.decode(value, { stream: true });
		if (currentText.startsWith('event: ping')) {
			continue;
		}
		const sanitizedText = currentText.replace('event: completion', '').trim();

		if (buffer.startsWith('data: ') && buffer.endsWith('}')) {
			try {
				const decodedLine = JSON.parse(buffer.slice(5));
				const completion = decodedLine['completion'];
				const stop_reason = decodedLine['stop_reason'];
				let transformedLine = {};
				if (stop_reason) {
					transformedLine = claudeToOpenAIResponse(
						{
							completion: '',
							stop_reason: stop_reason,
						},
						modelId,
						messageId,
						true,
					);
				} else {
					transformedLine = claudeToOpenAIResponse(
						{
							...decodedLine,
							completion: completion,
						},
						modelId,
						messageId,
						true,
					);
				}
				yield encoder.encode(`data: ${JSON.stringify(transformedLine)}\n\n`);
				buffer = '';
			} catch (e) {
				console.error(e);
			}
		}
		buffer += sanitizedText;
	}
}

async function handleClaudeRequest(
	request: Request,
	env: Env,
	requestBody: CreateChatCompletionRequest,
	modelId: string,
): Promise<Response> {
	const url = 'https://api.anthropic.com/v1/complete';
	const claudeRequestBody = toClaudeRequestBody(requestBody, modelId);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'Content-Type': 'application/json',
			'x-api-key': env.ANTHROPIC_API_KEY,
			'anthropic-version': env.ANTHROPIC_VERSION || '2023-06-01',
		},
		body: JSON.stringify(claudeRequestBody),
	});

	if (requestBody.stream) {
		return response;
	}

	// If the response is not streamed, read it as JSON and return a new Response object
	const responseBody = await response.json();
	// TODO: handle error response
	const messageId = generateRandomId();
	const openAIResponseBody = claudeToOpenAIResponse(responseBody, modelId, messageId, false);
	return new Response(JSON.stringify(openAIResponseBody), {
		status: response.status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function toPalmRequestBody(requestBody: CreateChatCompletionRequest) {
	const transformedBody = {
		temperature: requestBody?.temperature,
		candidateCount: requestBody?.n,
		topP: requestBody?.top_p,
		prompt: {
			context: requestBody?.messages?.find((msg) => msg.role === 'system')?.content,
			messages: requestBody?.messages
				?.filter((msg) => msg.role !== 'system')
				.map((msg) => ({
					// author: msg.role === 'user' ? '0' : '1',
					content: msg.content,
				})),
		},
	};

	return transformedBody;
}

// Function to transform the palm json response to openai json response
function palmResponseToOpenAI(palmData, modelId: string) {
	if (!palmData.candidates || palmData.candidates.length === 0) {
		palmData.candidates = [
			{
				author: '1',
				content: 'Ooops, the model returned nothing',
			},
		];
	}

	return {
		id: 'chatcmpl-QXlha2FBbmROaXhpZUFyZUF3ZXNvbWUK',
		object: 'chat.completion',
		created: Math.floor(Date.now() / 1000),
		model: modelId,
		usage: {
			prompt_tokens: palmData.messages.length,
			completion_tokens: palmData.candidates.length,
			total_tokens: palmData.messages.length + palmData.candidates.length,
		},
		choices: palmData.candidates.map((candidate, index) => ({
			message: {
				role: 'assistant',
				content: candidate.content,
			},
			finish_reason: 'stop',
			index: index,
		})),
	};
}

async function* streamPalmResponse(response, writable) {
	let encoder = new TextEncoder();
	let writer = writable.getWriter();
	let content = response.choices[0].message.content;

	// Split the content into chunks, and send each chunk as a separate event
	let chunks = content.match(/\s+|\S+/g) || [];
	for (const [i, chunk] of chunks.entries()) {
		let chunkResponse = {
			...response,
			object: 'chat.completion.chunk',
			choices: [
				{
					index: response.choices[0].index,
					delta: { ...response.choices[0].message, content: chunk },
					finish_reason: i === chunks.length - 1 ? 'stop' : null,
				},
			],
			usage: null,
		};

		writer.write(encoder.encode(`data: ${JSON.stringify(chunkResponse)}\n\n`));
	}

	// Write the done signal
	writer.write(encoder.encode(`data: [DONE]\n`));

	writer.close();
}

async function handlePalmRequest(request: Request, env: Env, requestBody: CreateChatCompletionRequest, modelId: string): Promise<Response> {
	let pathname = 'generateMessage';
	if (modelId === 'text-bison-001') pathname = 'generateText';
	const url = `https://generativelanguage.googleapis.com/v1beta2/models/${modelId}:${pathname}?key=${env.PALM_API_KEY}`;
	const palmRequestBody = toPalmRequestBody(requestBody);

	console.log(url);
	const response = await fetch(url, {
		method: request.method,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(palmRequestBody),
	});

	console.log(response);
	const palmData = await response.json();
	const transformedResponseBody = palmResponseToOpenAI(palmData, modelId);

	// Fake stream here for OpenAI, Palm is so fast that it is confident enough to return a response immediately
	if (requestBody.stream) {
		let { readable, writable } = new TransformStream();
		streamPalmResponse(transformedResponseBody, writable);

		return new Response(readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': '*',
				'Access-Control-Allow-Headers': '*',
			},
		});
	}

	return new Response(JSON.stringify(transformedResponseBody), {
		status: response.status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function handleError(e: any): Response {
	console.error(e);
	return new Response(
		JSON.stringify({
			error: JSON.stringify(e),
		}),
		{
			status: 500,
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		},
	);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const requestBody: CreateChatCompletionRequest = await request.json();
			const requestStream = requestBody.stream || false;
			const modelNames = requestBody.model.split(',');

			if (requestStream) {
				return handleStreamResponse(request, env, requestBody, modelNames);
			} else {
				return handleJsonResponse(request, env, requestBody, modelNames);
			}
		} catch (e) {
			return handleError(e);
		}
	},
};

async function getModel(env: Env, modelName: string): Promise<Model | null> {
	let model = await getModelFromKV(env, modelName);

	if (!model) {
		const providers = getAvailableProviders(env);
		const allModels = await fetchAllModels(env, providers, true);
		model = allModels.find((m) => m.id === modelName) || null;
	}

	return model;
}

async function handleStreamResponse(
	request: Request,
	env: Env,
	requestBody: CreateChatCompletionRequest,
	modelNames: string[],
): Promise<Response> {
	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	let errors: string[] = [];

	for (const modelName of modelNames) {
		const model = await getModel(env, modelName);
		// console.log(model);

		if (!model) {
			errors.push(`Model ${modelName} not found.`);
			continue;
		}

		try {
			const ServiceClass = providerServiceMap[model.provider];
			const serviceInstance = new ServiceClass();
			await serviceInstance.pipeStream(request, env, requestBody, model, writer);
		} catch (error) {
			errors.push(`Service for model ${modelName} error pipeStream.`);
			continue;
		}
	}

	if (errors.length) {
		// console.error(errors.join(', '));

		// Write the errors to the stream
		const encoder = new TextEncoder();
		await writer.write(encoder.encode(`Errors: ${errors.join(', ')}`));
	}

	await writer.close();

	// Return a new Response with the TransformStream's readable side
	return new Response(readable, {
		headers: { 'Content-Type': 'text/event-stream' },
	});
}

async function handleJsonResponse(
	request: Request,
	env: Env,
	requestBody: CreateChatCompletionRequest,
	modelNames: string[],
): Promise<Response> {
	let aggregatedId: string | null = null;
	let aggregatedChoices: any[] = [];
	let aggregatedPromptAnnotations: any[] = [];
	let totalTokens = 0;
	let errors: string[] = [];

	for (const modelName of modelNames) {
		const model = await getModel(env, modelName);

		if (!model) {
			errors.push(`Model ${modelName} not found.`);
			continue;
		}

		try {
			const ServiceClass = providerServiceMap[model.provider];
			const serviceInstance = new ServiceClass();
			const response = await serviceInstance.fetch(request, env, requestBody, model);

			if (!response.ok) {
				errors.push(`Error fetching model ${modelName}: ${response.statusText}`);
				continue;
			}

			const responseData: any = await response.json();
			if (!aggregatedId) {
				aggregatedId = responseData.id;
			}

			aggregatedChoices = aggregatedChoices.concat(responseData.choices);

			if (responseData.prompt_annotations) {
				aggregatedPromptAnnotations = aggregatedPromptAnnotations.concat(responseData.prompt_annotations);
			}

			if (responseData.usage && responseData.usage.total_tokens) {
				totalTokens += responseData.usage.total_tokens;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
			errors.push(`Error processing model ${modelName}: ${errorMessage}`);
		}
	}

	const mergedResponse = {
		id: aggregatedId || generateRandomId(),
		object: 'chat.completion',
		created: Date.now(),
		model: modelNames.join(','),
		choices: aggregatedChoices,
		prompt_annotations: aggregatedPromptAnnotations,
		usage: {
			total_tokens: totalTokens,
		},
		errors: errors,
	};

	return new Response(JSON.stringify(mergedResponse), {
		headers: { 'Content-Type': 'application/json' },
	});
}
