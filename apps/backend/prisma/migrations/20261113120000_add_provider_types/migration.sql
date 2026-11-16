-- 模型供应商扩展：新增 Anthropic / Gemini
ALTER TYPE "ModelProviderType" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
ALTER TYPE "ModelProviderType" ADD VALUE IF NOT EXISTS 'GEMINI';
