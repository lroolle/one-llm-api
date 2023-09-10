export interface Env {
  ONELLM_API_KEY: string;
  // OpenAI
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE?: string;
  // Azure openai
  AZURE_OPENAI_API_VERSION?: string;
  // modelId1,modelId2;modelId1,modelId2
  AZURE_OPENAI_DEPLOYMENTS?: string;
  // resouceName1:key1;resourceName2:key2
  AZURE_OPENAI_API_KEYS?: string;
  AZURE_OPENAI_API_BASE?: string;
  // Anthropic
  ANTHROPIC_VERSION?: string;
  ANTHROPIC_API_KEY?: string;
  // Google palm
  PALM_API_KEY?: string;
  // Namespaces
  ONELLM_KV: KVNamespace;
  ONELLM_LOGS: AnalyticsEngineDataset;
  // Test only
  MOCK_RESPONSE: boolean;
}
