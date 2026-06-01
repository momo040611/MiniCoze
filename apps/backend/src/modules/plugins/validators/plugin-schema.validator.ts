import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class PluginSchemaValidator {
  validateDefinition(schema: Record<string, unknown>): void {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new BusinessException(
        '插件 schema 必须是对象',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (schema.type !== 'object') {
      throw new BusinessException(
        '插件 schema 的 type 必须为 object',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  validateInput(
    schema: Record<string, unknown>,
    input: Record<string, unknown>,
  ): void {
    this.validateDefinition(schema);

    const properties = this.asObject(schema.properties);
    const required = Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];

    for (const key of required) {
      if (!(key in input) || input[key] === undefined || input[key] === null) {
        throw new BusinessException(
          `插件参数缺失: ${key}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    for (const [key, value] of Object.entries(input)) {
      const propertySchema = this.asObject(properties?.[key]);
      if (!propertySchema) {
        continue;
      }
      this.validateValue(key, value, propertySchema);
    }
  }

  private validateValue(
    key: string,
    value: unknown,
    schema: Record<string, unknown>,
  ): void {
    const expectedType =
      typeof schema.type === 'string' ? schema.type : undefined;
    if (expectedType && !this.matchesType(expectedType, value)) {
      throw new BusinessException(
        `插件参数类型错误: ${key}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      Array.isArray(schema.enum) &&
      value !== undefined &&
      !schema.enum.includes(value)
    ) {
      throw new BusinessException(
        `插件参数枚举错误: ${key}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private matchesType(expectedType: string, value: unknown): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return !!value && typeof value === 'object' && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private asObject(
    value: unknown,
  ): Record<string, Record<string, unknown>> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, Record<string, unknown>>;
  }
}
