/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { createCors, error, Router, IRequest } from 'itty-router';
import handleProxy from './proxy';
import handleModels from './models';
import { Env } from '../worker-configuration';

// create a convenient duple
type CF = [env: Env, context: ExecutionContext];

const { preflight, corsify } = createCors();
const router = Router<IRequest, CF>();

const withAuthorization = (request: Request, env: Env): Response | undefined => {
  const authHeader = request.headers.get('Authorization');
  // TODO: support x-api-key
  // const onellmKey = request.headers.get('X-API-KEY');
  if (!authHeader || authHeader !== `Bearer ${env.ONELLM_API_KEY}`) {
    const responseBody = {
      message: 'Invalid API key. You should find your valid ONELLM_API_KEY in the workers env, otherwise you will have to set it.',
      code: 'invalid_api_key',
    };
    return new Response(JSON.stringify(responseBody), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
};

router
  .all('*', preflight)
  .all('*', withAuthorization)
  .get('/v1/models', (request, env, ctx) => {
    return handleModels.fetch(request, env, ctx);
  })
  .post('/v1/chat/completions', (request, env, ctx) => {
    return handleProxy.fetch(request, env, ctx);
  })
  .all('*', () => new Response('Not Allowed', { status: 403 }));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx).catch(error).then(corsify);
  },
};
