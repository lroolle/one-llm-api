import { CreateChatCompletionRequest } from 'openai';
import { Env } from './worker';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export enum Provider {
  OpenAI = 'openai',
  AzureOpenAI = 'azure-openai',
  Anthropic = 'anthropic',
  Palm = 'palm',
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  provider: Provider;
  resource_name?: string; // Specific to AzureOpenAI
  resource_idx?: number; // Specific to AzureOpenAI, for env.AZURE_OPENAI_API_KEYS[resource_idx]
}

export function getAvailableProviders(env: Env): Provider[] {
  const providers: Provider[] = [];

  if (env.OPENAI_API_KEY) {
    providers.push(Provider.OpenAI);
  }
  if (env.AZURE_OPENAI_API_KEYS) {
    providers.push(Provider.AzureOpenAI);
  }
  if (env.ANTHROPIC_API_KEY) {
    providers.push(Provider.Anthropic);
  }
  if (env.PALM_API_KEY) {
    providers.push(Provider.Palm);
  }

  return providers;
}

export interface ServiceProvider {
  fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model): Promise<Response>;
  pipeStream(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model, writer: WritableStreamDefaultWriter): any;
  getModels(env: Env): Promise<Model[]>;
}

export class OpenAIService implements ServiceProvider {
  async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model): Promise<Response> {
    const defaultBase = 'https://api.openai.com';
    const baseUrl = env.OPENAI_API_BASE || defaultBase;

    const url = new URL(request.url);
    url.protocol = new URL(baseUrl).protocol;
    url.hostname = new URL(baseUrl).hostname;
    url.port = '';

    requestBody.model = model.id;
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
    model: Model,
    writer: WritableStreamDefaultWriter,
  ) {
    const response = await this.fetch(request, env, requestBody, model);
    const reader = response?.body?.getReader();
    while (true && reader != null) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      writer.write(value);
    }
  }

  async getModels(env: Env): Promise<Model[]> {
    if (!env.OPENAI_API_KEY) {
      return [];
    }

    const defaultBase = 'https://api.openai.com';
    const baseUrl = env.OPENAI_API_BASE || defaultBase;

    const url = `${baseUrl}/v1/models`;
    const openaiRequest = new Request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    });

    try {
      const response = await fetch(openaiRequest);
      if (!response.ok) {
        console.error(`OpenAI API Error: ${response.statusText}`);
        return [];
      }

      const data: any = await response.json();

      // Filter models whose ID starts with "gpt-"
      const gptModels = data.data.filter((model: any) => model.id.startsWith('gpt-'));

      // Map over the filtered models to add the provider field
      return gptModels.map((model: Model) => ({
        ...model,
        provider: Provider.OpenAI,
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }
}

export class AzureOpenAIService implements ServiceProvider {
  async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model): Promise<Response> {
    if (!model.resource_name) {
      throw new Error('Invalid Azure model configuration. Missing resource_name.');
    }

    const defaultBase = `https://${model.resource_name}.openai.azure.com`;
    const baseUrl = env.AZURE_OPENAI_API_BASE || defaultBase;

    const url = new URL(baseUrl);
    url.pathname = `/openai/deployments/${model.id}/chat/completions`;
    url.searchParams.set('api-version', env.AZURE_OPENAI_API_VERSION || '2023-06-01-preview');

    requestBody.model = model.id;

    let apiKey: string;
    try {
      apiKey = this.getAzureApiKey(env, model.resource_idx);
    } catch (error) {
      throw new Error('Invalid Azure model configuration. Missing api-key.');
    }

    const azureRequest = new Request(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const response = await fetch(azureRequest);
    if (!response.ok) {
      throw new Error(`Azure API Error: ${response.statusText}`);
    }
    return response;
  }

  async pipeStream(
    request: Request,
    env: Env,
    requestBody: CreateChatCompletionRequest,
    model: Model,
    writer: WritableStreamDefaultWriter,
  ) {
    // see: https://github.com/haibbo/cf-openai-azure-proxy/blob/main/cf-openai-azure-proxy.js
    const response = await this.fetch(request, env, requestBody, model);
    const reader = response?.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const newline = '\n';
    const delimiter = '\n\n';
    const encodedNewline = encoder.encode(newline);

    let buffer = '';
    while (true && reader != null) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      // stream: true is important here,fix the bug of incomplete line
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split(delimiter);

      // Loop through all but the last line, which may be incomplete.
      for (let i = 0; i < lines.length - 1; i++) {
        await writer.write(encoder.encode(lines[i] + delimiter));
        await sleep(20);
      }

      buffer = lines[lines.length - 1];
    }

    if (buffer) {
      await writer.write(encoder.encode(buffer));
    }
    await writer.write(encodedNewline);
  }

  private getAzureApiKey(env: Env, resourceIdx: number | undefined): string {
    const apiKeys = env.AZURE_OPENAI_API_KEYS?.split(';').map((keyPair) => keyPair.split(':')[1]) || [];
    if (resourceIdx !== undefined && resourceIdx >= 0 && resourceIdx < apiKeys.length) {
      return apiKeys[resourceIdx];
    }
    throw new Error(`Invalid resource index ${resourceIdx} for API keys.`);
  }

  private parseAzureDeploymentConfig(env: Env): { resource_name: string; model_ids: string[]; resource_idx: number }[] {
    const resourceDeployments = env.AZURE_OPENAI_DEPLOYMENTS?.split(';') || [];
    const resourceKeys = env.AZURE_OPENAI_API_KEYS?.split(';').map((key) => key.split(':')[0]) || [];

    return resourceDeployments.map((modelIds, index) => {
      const resourceName = resourceKeys[index];
      return {
        resource_name: resourceName,
        model_ids: modelIds.split(','),
        resource_idx: index,
      };
    });
  }

  async getModels(env: Env): Promise<Model[]> {
    const configs = this.parseAzureDeploymentConfig(env);
    if (configs.length === 0) {
      return [];
    }

    const allModels: Model[] = configs.flatMap((config) =>
      config.model_ids.map((modelId) => ({
        id: modelId,
        object: 'model',
        created: Date.now(), // You might want to adjust this if you have a specific creation time
        owned_by: 'azure-openai',
        provider: Provider.AzureOpenAI,
        resource_name: config.resource_name,
        resource_idx: config.resource_idx,
      })),
    );

    return allModels;
  }

  private parseAzureConfig(env: Env): { resource_name: string; api_key: string }[] {
    return (env.AZURE_OPENAI_CONFIG?.split(';') || []).map((config) => {
      const [sub_id, resource_name, api_key] = config.split(':');
      return { sub_id, resource_name, api_key };
    });
  }

  private async fetchModelsForAzureResource(
    config: { sub_id: string; resource_name: string; api_key: string },
    env: Env,
  ): Promise<Model[]> {
    // I was intended to retrieve the models from this api, but seems like the authorization for this endpoint
    // only allows the oauth token from the azure portal, which is not possible to maintain here.
    // leave the method here for some day the azure models list api may support the api-key authorization.
    // Oh, there's another endpoint using the api-key, which is https://learn.microsoft.com/en-us/rest/api/cognitiveservices/azureopenaipreview/models/list
    // however, it lists the accessible models instead your deployments, which is not what we want.
    const { sub_id, resource_name, api_key } = config;

    const url = `https://management.azure.com/subscriptions/${sub_id}/resourceGroups/${resource_name}/providers/Microsoft.CognitiveServices/accounts/${resource_name}/deployments?api-version=${
      env.AZURE_OPENAI_API_VERSION || '2023-05-01'
    }`;

    try {
      const azureRequest = new Request(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // 'api-key': api_key,
          Authorization: `Bearer ${api_key}`,
        },
      });

      const response = await fetch(azureRequest);
      if (!response.ok) {
        console.error(`Azure API Error for resource ${resource_name}: ${response.statusText}`);
        return []; // Return empty array for this resource
      }

      const azureData: any = await response.json();

      return azureData.value.map((item: any) => ({
        id: item.name,
        object: 'model',
        created: new Date(item.systemData.createdAt).getTime() / 1000,
        owned_by: 'azure-openai',
        provider: Provider.AzureOpenAI,
        resource_name: resource_name,
        resource_api_key: api_key,
      }));
    } catch (error) {
      console.error(`Failed to fetch models from Azure for resource ${resource_name}. Error:`, error);
      return []; // Return empty array for this resource
    }
  }
}

export class AnthropicService implements ServiceProvider {
  async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model): Promise<Response> {
    throw new Error('ClaudeService: fetch method not implemented.');
  }

  async getModels(env: Env): Promise<Model[]> {
    throw new Error('ClaudeService: getModels method not implemented.');
  }

  async pipeStream(
    request: Request,
    env: Env,
    requestBody: CreateChatCompletionRequest,
    model: Model,
    writer: WritableStreamDefaultWriter,
  ): Promise<void> {
    throw new Error('ClaudeService: pipeStream method not implemented.');
  }
}

export class PalmService implements ServiceProvider {
  async fetch(request: Request, env: Env, requestBody: CreateChatCompletionRequest, model: Model): Promise<Response> {
    throw new Error('PalmService: fetch method not implemented.');
  }

  async getModels(env: Env): Promise<Model[]> {
    throw new Error('PalmService: getModels method not implemented.');
  }

  async pipeStream(
    request: Request,
    env: Env,
    requestBody: CreateChatCompletionRequest,
    model: Model,
    writer: WritableStreamDefaultWriter,
  ): Promise<void> {
    throw new Error('PalmService: pipeStream method not implemented.');
  }
}

export const providerServiceMap: Record<Provider, new () => ServiceProvider> = {
  [Provider.OpenAI]: OpenAIService,
  [Provider.AzureOpenAI]: AzureOpenAIService,
  [Provider.Anthropic]: AnthropicService,
  [Provider.Palm]: PalmService,
};

async function fetchModelsFromService(service: ServiceProvider, env: Env): Promise<Model[]> {
  try {
    return await service.getModels(env);
  } catch (error) {
    console.error(`Error fetching models from ${service.constructor.name}:`, error);
    return [];
  }
}

function createServiceInstances(providers: Provider[]): ServiceProvider[] {
  return providers.map((provider) => {
    const ServiceClass = providerServiceMap[provider];
    if (!ServiceClass) {
      throw new Error(`NotImplementedError: ${provider} is not yet supported.`);
    }
    return new ServiceClass();
  });
}

async function storeModelInKV(env: Env, modelName: string, modelData: Model) {
  const kvValue = JSON.stringify(modelData);
  await env.onellmapi.put(modelName, kvValue);
}

export async function getModelFromKV(env: Env, modelName: string): Promise<Model | null> {
  const kvValue = await env.onellmapi.get(modelName);
  if (kvValue) {
    return JSON.parse(kvValue) as Model;
  }
  return null;
}

async function fetchModelsFromServiceAndCache(service: ServiceProvider, env: Env, forceRefresh: boolean = false): Promise<Model[]> {
  try {
    const models = await service.getModels(env);

    // Store each model individually in KV using its id as the key
    for (const model of models) {
      if (forceRefresh || !(await getModelFromKV(env, model.id))) {
        await storeModelInKV(env, model.id, model);
      }
    }

    return models;
  } catch (error) {
    console.error(`Error fetching models from ${service.constructor.name}:`, error);
    return [];
  }
}

export async function fetchAllModels(env: Env, providers: Provider[], forceRefresh: boolean = false): Promise<Model[]> {
  const services = createServiceInstances(providers);

  const allModelsPromises = services.map((service) => fetchModelsFromServiceAndCache(service, env, forceRefresh));
  const modelsFromAllServices = await Promise.all(allModelsPromises);

  // Flatten the array of arrays into a single array of models
  return modelsFromAllServices.flat();
}
