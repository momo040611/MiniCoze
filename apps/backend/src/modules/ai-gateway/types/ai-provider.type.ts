export enum AiProvider {
  OPENAI = 'openai',
  DEEPSEEK = 'deepseek',
}

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  // 动态 Provider 可传入完整认证 headers；旧环境变量 Provider 不传时继续使用 Bearer apiKey。
  headers?: Record<string, string>;
}
