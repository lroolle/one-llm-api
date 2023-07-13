/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import handleProxy from './proxy';
import models from './models';

export default {
	// The fetch handler is invoked when this worker receives a HTTP(S) request
	// and should return a Response (optionally wrapped in a Promise)
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		switch (request.method) {
			case 'POST':
				// Validate the Authorization API key is in the worker environment variables
				const authHeader = request.headers.get('Authorization');
				if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
					return new Response('Unauthorized', { status: 401 });
				}

				const url = new URL(request.url);
				switch (url.pathname) {
					case '/v1/models':
						return new Response(JSON.stringify(models), { headers: { 'Content-Type': 'application/json' } });
					case '/v1/chat/completions':
						return handleProxy.fetch(request, env, ctx);
					default:
						return new Response('Not Found', { status: 404 });
				}
			case 'OPTIONS':
				return handleOptions();
			default:
				// TODO: add an about/into page maybe.
				return new Response('Not Allowed', { status: 403 });
		}
	},
};

function handleOptions() {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': '*',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Credentials': 'true',
		},
	});
}
