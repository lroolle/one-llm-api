import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  CreateChatCompletionResponse,
  CreateChatCompletionResponseChoicesInner,
} from 'openai';
import api from 'gpt-tokenizer/esm/main';

const modelName = 'gpt-4'; // cl100k_base

api.modelName = modelName;

export function countChatTokens(messages: Array<ChatCompletionRequestMessage>) {
  const chatTokens = api.encodeChat(messages, modelName);
  return chatTokens.length;
}

export function countTokens(text: string): number {
  return api.encode(text).length;
}

export function parseChunks(fullChunk: string) {
  return fullChunk
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => {
      try {
        return JSON.parse(line.replace('data: ', ''));
      } catch (error) {
        console.error(`Failed parsing line: ${line}`);
      }
    });
}

export function extractChatResponse(rawChunks: string): CreateChatCompletionResponse {
  let chatId: string | null = null;
  let respModel: string | null = null;
  let objectType: string | null = null;
  let createdTimestamp: number | null = null;
  let fullContent = '';
  let functionCallArgs = '';
  let functionName: string | null = null;
  let choices: Array<CreateChatCompletionResponseChoicesInner> = [];
  let functionTokens = 0;

  const chunks = parseChunks(rawChunks);

  for (const chunk of chunks) {
    if (!chunk || !chunk.id || !chunk.model || !chunk.object) continue;

    const chunkDelta = chunk.choices?.[0]?.delta;
    if (chunkDelta?.content && chunkDelta.content.trim() !== '') {
      fullContent += chunkDelta.content;
    }

    if (chunkDelta?.function_call) {
      if (chunkDelta.function_call.arguments && chunkDelta.function_call.arguments.trim() !== '') {
        functionCallArgs += chunkDelta.function_call.arguments;
      }
      if (!functionName && chunkDelta.function_call.name) {
        functionName = chunkDelta.function_call.name;
        functionTokens += countTokens(functionName);
      }
    }

    chatId = chatId ?? chunk.id;
    respModel = respModel ?? chunk.model;
    objectType = objectType ?? chunk.object;
    createdTimestamp = createdTimestamp ?? chunk.created;
  }

  const functionCall = functionCallArgs
    ? {
        name: functionName,
        arguments: JSON.parse(functionCallArgs),
      }
    : null;

  if (functionCallArgs) {
    functionTokens += countTokens(functionCallArgs);
  }

  const message: ChatCompletionResponseMessage = {
    role: 'assistant',
    function_call: functionCall,
  };

  if (fullContent.trim() !== '') {
    message.content = fullContent;
  }

  choices.push({
    index: 0,
    message: message,
    finish_reason: chunks[chunks.length - 1]?.choices[0]?.finish_reason ?? null,
  });

  const contentTokens = countTokens(fullContent);

  return {
    id: chatId!,
    model: respModel!,
    object: objectType!,
    created: createdTimestamp!,
    choices,
    usage: {
      prompt_tokens: 0, // Placeholder, adjust as needed
      completion_tokens: contentTokens + functionTokens,
      total_tokens: contentTokens + functionTokens, // Adjust if you're counting prompt tokens
    },
  };
}
