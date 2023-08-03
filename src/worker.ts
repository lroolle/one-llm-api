/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Router, IRequest } from 'itty-router';
import handleProxy from './proxy';
import models from './models';

// declare what's available in our env
export interface Env {
	API_KEY: string;
	OPENAI_API_KEY: string;
	ANTHROPIC_VERSION: string;
	AZURE_OPENAI_API_KEY: string;
	AZURE_OPENAI_API_VERSION: string;
	AZURE_OPENAI_RESOURCE_NAME: string;
	ANTHROPIC_API_KEY: string;
	PALM_API_KEY: string;
}

// create a convenient duple
type CF = [env: Env, context: ExecutionContext];

const router = Router<IRequest, CF>();

router
	.options(
		'*',
		() =>
			new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': '*',
					'Access-Control-Allow-Headers': '*',
					'Access-Control-Allow-Credentials': 'true',
				},
			})
	)
	.post('/v1/models', (request, env) => {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
			return new Response('Unauthorized', { status: 401 });
		}
		return new Response(JSON.stringify(models), { headers: { 'Content-Type': 'application/json' } });
	})
	.post('/v1/chat/completions', (request, env, ctx) => {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
			return new Response('Unauthorized', { status: 401 });
		}

		return handleProxy.fetch(request, env, ctx);
	})
	.all('*', () => new Response('Not Allowed', { status: 403 }));

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return router.handle(request, env, ctx);
	},
};
