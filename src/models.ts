import { Model, ListModelsResponse } from 'openai';

const filterChatCompatibleModels = (response: ListModelsResponse): Array<Model> => {
	const chatCompatibleModels = [
		'gpt-4',
		'gpt-4-0613',
		'gpt-4-32k',
		'gpt-4-32k-0613',
		'gpt-3.5-turbo',
		'gpt-3.5-turbo-0613',
		'gpt-3.5-turbo-16k',
		'gpt-3.5-turbo-16k-0613',
		// azure
		'gpt-35-turbo',
		'gpt-35-turbo-16k',
		// claude
		'claude-instant-1',
		'claude-2',
		// palm
		'text-bison-001',
		'chat-bison-001',
	];

	return response.data.filter((model) => chatCompatibleModels.includes(model.id));
};

// The full list of models is retrieved from the following API, models are vary depends on your account.
// https://api.openai.com/v1/models
const openaiResponse: ListModelsResponse = {
	object: 'list',
	data: [
		{
			id: 'gpt-3.5-turbo-16k-0613',
			object: 'model',
			created: 1685474247,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-ZY0iXVEnYcuTmNTeVNoZLg0n',
					object: 'model_permission',
					created: 1688692724,
					allow_create_engine: false,
					allow_sampling: true,
					allow_logprobs: true,
					allow_search_indices: false,
					allow_view: true,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-3.5-turbo-16k-0613',
			parent: null,
		},
		{
			id: 'gpt-3.5-turbo-0301',
			object: 'model',
			created: 1677649963,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-TBa0NeEwCp3BQtV3fxDVx2fs',
					object: 'model_permission',
					created: 1689207811,
					allow_create_engine: false,
					allow_sampling: true,
					allow_logprobs: true,
					allow_search_indices: false,
					allow_view: true,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-3.5-turbo-0301',
			parent: null,
		},
		{
			id: 'gpt-3.5-turbo-16k',
			object: 'model',
			created: 1683758102,
			owned_by: 'openai-internal',
			permission: [
				{
					id: 'modelperm-incf1vHEBCbZnCddTGBKniux',
					object: 'model_permission',
					created: 1688692820,
					allow_create_engine: false,
					allow_sampling: true,
					allow_logprobs: true,
					allow_search_indices: false,
					allow_view: true,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-3.5-turbo-16k',
			parent: null,
		},
		{
			id: 'gpt-4-0314',
			object: 'model',
			created: 1687882410,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-p5ay61B8HMtrn6P8RCLOcANc',
					object: 'model_permission',
					created: 1689084227,
					allow_create_engine: false,
					allow_sampling: false,
					allow_logprobs: false,
					allow_search_indices: false,
					allow_view: false,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-4-0314',
			parent: null,
		},
		{
			id: 'gpt-3.5-turbo',
			object: 'model',
			created: 1677610602,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-gF0u9UfHJRjpblMAfUH9McFM',
					object: 'model_permission',
					created: 1689189326,
					allow_create_engine: false,
					allow_sampling: true,
					allow_logprobs: true,
					allow_search_indices: false,
					allow_view: true,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-3.5-turbo',
			parent: null,
		},
		{
			id: 'gpt-3.5-turbo-0613',
			object: 'model',
			created: 1686587434,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-dusUadKLXIZuBeoRdmZcSDL8',
					object: 'model_permission',
					created: 1689189356,
					allow_create_engine: false,
					allow_sampling: true,
					allow_logprobs: true,
					allow_search_indices: false,
					allow_view: true,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-3.5-turbo-0613',
			parent: null,
		},
		{
			id: 'gpt-4',
			object: 'model',
			created: 1687882411,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-glQVPpxp3tP8UNTh6k8U3HSf',
					object: 'model_permission',
					created: 1689189635,
					allow_create_engine: false,
					allow_sampling: false,
					allow_logprobs: false,
					allow_search_indices: false,
					allow_view: false,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-4',
			parent: null,
		},
		{
			id: 'gpt-4-0613',
			object: 'model',
			created: 1686588896,
			owned_by: 'openai',
			permission: [
				{
					id: 'modelperm-mDfxFax8HtDjp4F3BsTq9aNX',
					object: 'model_permission',
					created: 1689189651,
					allow_create_engine: false,
					allow_sampling: false,
					allow_logprobs: false,
					allow_search_indices: false,
					allow_view: false,
					allow_fine_tuning: false,
					organization: '*',
					group: null,
					is_blocking: false,
				},
			],
			root: 'gpt-4-0613',
			parent: null,
		},
	],
};

const fakePermission = {
	id: 'modelperm-incf1vHEBCbZnCddTGBKniux',
	object: 'model_permission',
	created: 1688692820,
	allow_create_engine: false,
	allow_sampling: true,
	allow_logprobs: true,
	allow_search_indices: false,
	allow_view: true,
	allow_fine_tuning: false,
	organization: '*',
	group: null,
	is_blocking: false,
};

// The Azure openai service model id are vary by the deployment name you choose.
// Deployment list can be retrieved with the REST API, read more in:
// https://learn.microsoft.com/en-us/rest/api/cognitiveservices/accountmanagement/deployments/list?tabs=HTTP#code-try-0
const fakeAzureResponse: ModelListResponse = {
	object: 'list',
	data: [
		{
			id: 'gpt-35-turbo',
			object: 'model',
			created: 1683758102,
			owned_by: 'azure-openai',
			permission: [fakePermission],
			root: 'gpt-3.5-turbo',
			parent: null,
		},
		{
			id: 'gpt-35-turbo-16k',
			object: 'model',
			created: 1683758102,
			owned_by: 'azure-openai',
			permission: [fakePermission],
			root: 'gpt-3.5-turbo-16k',
			parent: null,
		},
	],
};

// Claude models
// https://docs.anthropic.com/claude/reference/selecting-a-model
const fakeClaudeResponse: ModelListResponse = {
	object: 'list',
	data: [
		{
			id: 'claude-instant-1',
			object: 'model',
			created: 1683758102,
			owned_by: 'claude',
			permission: [fakePermission],
			root: 'claude-instant-1',
			parent: null,
		},
		{
			id: 'claude-instant-1.1',
			object: 'model',
			created: 1683758102,
			owned_by: 'claude',
			permission: [fakePermission],
			root: 'claude-instant-1.1',
			parent: null,
		},
		{
			id: 'claude-2',
			object: 'model',
			created: 1683758102,
			owned_by: 'claude',
			permission: [fakePermission],
			root: 'claude-2',
			parent: null,
		},
		{
			id: 'claude-2.0',
			object: 'model',
			created: 1683758102,
			owned_by: 'claude',
			permission: [fakePermission],
			root: 'claude-2.0',
			parent: null,
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
			permission: [fakePermission],
			root: 'text-bison-001',
			parent: null,
		},
		{
			id: 'chat-bison-001',
			object: 'model',
			created: 1683758102,
			owned_by: 'palm',
			permission: [fakePermission],
			root: 'chat-bison-001',
			parent: null,
		},
		{
			id: 'embedding-gecko-001',
			object: 'model',
			created: 1683758102,
			owned_by: 'palm',
			permission: [],
			root: 'embedding-gecko-001',
			parent: null,
		},
	],
};

const models: ListModelsResponse = {
	object: 'list',
	data: [
		...filterChatCompatibleModels(openaiResponse),
		...filterChatCompatibleModels(fakeAzureResponse),
		...filterChatCompatibleModels(fakeClaudeResponse),
		...filterChatCompatibleModels(fakePalmResponse),
	],
};

export default models;
