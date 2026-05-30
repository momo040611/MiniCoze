import { Injectable } from '@nestjs/common';
import { type PluginMaskStrategy } from '../types/plugin.types';

@Injectable()
export class PluginMaskerService {
  private readonly defaultSensitiveKeys = new Set([
    'token',
    'apiKey',
    'authorization',
    'password',
    'secret',
    'cookie',
  ]);

  summarizeInput(
    value: unknown,
    strategy?: PluginMaskStrategy | null,
  ): unknown {
    return this.applyRule(value, strategy?.input, 200);
  }

  summarizeOutput(
    value: unknown,
    strategy?: PluginMaskStrategy | null,
  ): unknown {
    return this.applyRule(value, strategy?.output, 500);
  }

  summarizeError(error: unknown, strategy?: PluginMaskStrategy | null): string {
    const message = error instanceof Error ? error.message : String(error);
    return this.truncate(message, strategy?.error?.maxStringLength ?? 500);
  }

  private applyRule(
    value: unknown,
    rule: PluginMaskStrategy['input'],
    defaultMaxLength: number,
  ): unknown {
    const maskPaths = new Set(rule?.maskPaths ?? []);
    const dropPaths = new Set(rule?.dropPaths ?? []);
    const maxLength = rule?.maxStringLength ?? defaultMaxLength;

    return this.walk(value, '', { maskPaths, dropPaths, maxLength });
  }

  private walk(
    value: unknown,
    path: string,
    options: {
      maskPaths: Set<string>;
      dropPaths: Set<string>;
      maxLength: number;
    },
  ): unknown {
    if (options.dropPaths.has(path)) {
      return undefined;
    }

    if (this.shouldMask(path)) {
      return '***';
    }

    if (typeof value === 'string') {
      return this.truncate(value, options.maxLength);
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 20)
        .map((item, index) =>
          this.walk(item, this.joinPath(path, String(index)), options),
        )
        .filter((item) => item !== undefined);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .map(([key, val]) => [
            key,
            this.walk(val, this.joinPath(path, key), options),
          ])
          .filter(([, val]) => val !== undefined),
      );
    }

    return value;
  }

  private shouldMask(path: string): boolean {
    if (!path) {
      return false;
    }
    const key = path.split('.').pop() ?? '';
    return this.defaultSensitiveKeys.has(key);
  }

  private joinPath(parent: string, key: string): string {
    return parent ? `${parent}.${key}` : key;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
