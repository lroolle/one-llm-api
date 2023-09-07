import { getAvailableProviders, fetchAllModels } from './services';
import { Provider } from './services';
import { Env } from '../worker-configuration';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Extract the providers from the search parameters
      const url = new URL(request.url);
      const providersParam = url.searchParams.get('providers');
      let providers: Provider[] = [];

      if (providersParam) {
        const potentialProviders = providersParam.split(',');
        for (const potentialProvider of potentialProviders) {
          if (Object.values(Provider).includes(potentialProvider as Provider)) {
            providers.push(potentialProvider as Provider);
          } else {
            console.warn(`Unknown provider: ${potentialProvider}`);
          }
        }
      }

      console.log(providers);
      // If no providers are specified in the request, use the default providers available in the env
      if (!providers.length) {
        providers = getAvailableProviders(env);
      }

      const forceRefreshCache = url.searchParams.get('forceRefreshCache') === 'true';
      const combinedModels = await fetchAllModels(env, providers, forceRefreshCache);

      // Return the combined models as a JSON response
      return new Response(
        JSON.stringify({
          object: 'list',
          data: combinedModels,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error fetching models:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch models.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};

// Claude models
// https://docs.anthropic.com/claude/reference/selecting-a-model
const fakeClaudeResponse: ListModelsResponse = {
  object: 'list',
  data: [
    {
      id: 'claude-instant-1',
      object: 'model',
      created: 1683758102,
      owned_by: 'claude',
    },
    {
      id: 'claude-instant-1.1',
      object: 'model',
      created: 1683758102,
      owned_by: 'claude',
    },
    {
      id: 'claude-2',
      object: 'model',
      created: 1683758102,
      owned_by: 'claude',
    },
    {
      id: 'claude-2.0',
      object: 'model',
      created: 1683758102,
      owned_by: 'claude',
    },
  ],
};

// Google palm models
// https://developers.generativeai.google/models/language
const fakePalmResponse: ListModelsResponse = {
  object: 'list',
  data: [
    {
      id: 'text-bison-001',
      object: 'model',
      created: 1683758102,
      owned_by: 'palm',
    },
    {
      id: 'chat-bison-001',
      object: 'model',
      created: 1683758102,
      owned_by: 'palm',
    },
    // {
    // 	id: 'embedding-gecko-001',
    // 	object: 'model',
    // 	created: 1683758102,
    // 	owned_by: 'palm',
    // },
  ],
};
