export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  cors: {
    origins: (
      process.env.CORS_ORIGIN ??
      'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  file: {
    uploadDir: process.env.FILE_UPLOAD_DIR ?? 'storage/uploads',
    publicBaseUrl: process.env.FILE_PUBLIC_BASE_URL ?? '/api/files',
    maxImageSize: Number(process.env.FILE_MAX_IMAGE_SIZE ?? 5242880),
    maxDocumentSize: Number(process.env.FILE_MAX_DOCUMENT_SIZE ?? 52428800),
  },
  ai: {
    provider: process.env.AI_PROVIDER,
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
    },
  },
  search: {
    bing: {
      apiKey: process.env.BING_SEARCH_API_KEY,
      endpoint:
        process.env.BING_SEARCH_ENDPOINT ??
        'https://api.bing.microsoft.com/v7.0/search',
      timeoutMs: Number(process.env.BING_SEARCH_TIMEOUT_MS ?? 10000),
    },
  },
  imageUnderstanding: {
    apiKey:
      process.env.IMAGE_UNDERSTANDING_API_KEY ?? process.env.OPENAI_API_KEY,
    baseUrl:
      process.env.IMAGE_UNDERSTANDING_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      'https://api.openai.com/v1',
    model: process.env.IMAGE_UNDERSTANDING_MODEL ?? 'gpt-4o-mini',
    timeoutMs: Number(process.env.IMAGE_UNDERSTANDING_TIMEOUT_MS ?? 20000),
  },
});
