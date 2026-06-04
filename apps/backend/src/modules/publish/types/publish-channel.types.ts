import { PublishChannelType } from '@prisma/client';

export interface WebPublishChannelConfig {
  slug: string;
  publicPath: string;
  embedPath: string;
  allowAnonymous: boolean;
  theme: string;
  showBranding: boolean;
  allowedOrigins: string[];
}

export interface ApiPublishChannelConfig {
  apiKeyHash: string | null;
  apiKeyPrefix: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedOrigins: string[];
  allowedIps: string[];
  expiresAt: string | null;
}

export type PublishChannelConfig =
  | WebPublishChannelConfig
  | ApiPublishChannelConfig;

export interface PublishChannelResponse {
  id: string;
  channel: PublishChannelType;
  enabled: boolean;
  config: PublishChannelConfig;
  createdAt: string;
  updatedAt: string;
}

export interface RotateApiKeyResponse {
  apiKey: string;
  apiKeyPrefix: string;
  rotatedAt: string;
}
