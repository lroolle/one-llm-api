import { Model, ListModelsResponse } from 'openai';

// TODO use a configurable toml file to store this

// TODO rm this
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
		},
		{
			id: 'gpt-3.5-turbo-0301',
			object: 'model',
			created: 1677649963,
			owned_by: 'openai',
		},
		{
			id: 'gpt-3.5-turbo-16k',
			object: 'model',
			created: 1683758102,
			owned_by: 'openai-internal',
		},
		{
			id: 'gpt-4-0314',
			object: 'model',
			created: 1687882410,
			owned_by: 'openai',
		},
		{
			id: 'gpt-3.5-turbo',
			object: 'model',
			created: 1677610602,
			owned_by: 'openai',
		},
		{
			id: 'gpt-3.5-turbo-0613',
			object: 'model',
			created: 1686587434,
			owned_by: 'openai',
		},
		{
			id: 'gpt-4',
			object: 'model',
			created: 1687882411,
			owned_by: 'openai',
		},
		{
			id: 'gpt-4-0613',
			object: 'model',
			created: 1686588896,
			owned_by: 'openai',
		},
	],
};

// The Azure openai service model id are vary by the deployment name you choose.
// Deployment list can be retrieved with the REST API, read more in:
// https://learn.microsoft.com/en-us/rest/api/cognitiveservices/accountmanagement/deployments/list?tabs=HTTP#code-try-0
const fakeAzureResponse: ListModelsResponse = {
	object: 'list',
	data: [
		{
			id: 'gpt-35-turbo',
			object: 'model',
			created: 1683758102,
			owned_by: 'azure-openai',
		},
		{
			id: 'gpt-35-turbo-16k',
			object: 'model',
			created: 1683758102,
			owned_by: 'azure-openai',
		},
	],
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
