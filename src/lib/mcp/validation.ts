import type { Schema } from './toolDefinitions';

export class McpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

export function invalid(message: string): never {
  throw new McpToolError('INVALID_ARGUMENT', message);
}

/** Schema validation is performed locally as well as by the MCP client. */
export function validate(
  value: unknown,
  schema: Schema,
  path = 'arguments'
): void {
  if (schema.anyOf) {
    const matches = schema.anyOf.some(option => {
      try {
        validate(value, option, path);
        return true;
      } catch (error) {
        if (error instanceof McpToolError) return false;
        throw error;
      }
    });
    if (!matches) invalid(`${path} must match one of its allowed formats`);
  }
  switch (schema.type) {
    case 'null':
      if (value !== null) invalid(`${path} must be null`);
      break;
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        invalid(`${path} must be an object`);
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (
        schema.minProperties !== undefined &&
        keys.length < schema.minProperties
      )
        invalid(`${path} cannot be empty`);
      if (
        schema.maxProperties !== undefined &&
        keys.length > schema.maxProperties
      )
        invalid(`${path} has too many fields`);
      for (const field of schema.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(record, field))
          invalid(`${path}.${field} is required`);
      }
      for (const key of keys) {
        const child =
          schema.properties &&
          Object.prototype.hasOwnProperty.call(schema.properties, key)
            ? schema.properties[key]
            : typeof schema.additionalProperties === 'object'
              ? schema.additionalProperties
              : undefined;
        if (
          !child ||
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        )
          invalid(`${path}.${key} is not allowed`);
        validate(record[key], child, `${path}.${key}`);
      }
      break;
    }
    case 'string': {
      if (typeof value !== 'string') invalid(`${path} must be a string`);
      if (
        schema.minLength !== undefined &&
        value.trim().length < schema.minLength
      )
        invalid(`${path} is too short`);
      if (schema.maxLength !== undefined && value.length > schema.maxLength)
        invalid(`${path} is too long`);
      if (schema.format === 'date') {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value
        )
          invalid(`${path} must be a valid YYYY-MM-DD date`);
      }
      if (schema.format === 'date-time') {
        if (
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(
            value
          ) ||
          !Number.isFinite(Date.parse(value))
        )
          invalid(`${path} must be an RFC3339 timestamp with timezone`);
        const hour = Number(value.slice(11, 13));
        const minute = Number(value.slice(14, 16));
        const second = Number(value.slice(17, 19));
        const offset = value.match(/[+-](\d{2}):(\d{2})$/);
        if (
          hour > 23 ||
          minute > 59 ||
          second > 59 ||
          (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59))
        )
          invalid(`${path} contains an invalid time or offset`);
        const day = value.slice(0, 10);
        if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)
          invalid(`${path} contains an invalid calendar date`);
      }
      break;
    }
    case 'number':
    case 'integer':
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (schema.type === 'integer' && !Number.isSafeInteger(value))
      )
        invalid(`${path} must be a finite ${schema.type}`);
      if (schema.minimum !== undefined && value < schema.minimum)
        invalid(`${path} must be at least ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum)
        invalid(`${path} must be at most ${schema.maximum}`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') invalid(`${path} must be a boolean`);
      break;
    case 'array':
      if (!Array.isArray(value)) invalid(`${path} must be an array`);
      if (schema.minItems !== undefined && value.length < schema.minItems)
        invalid(`${path} has too few items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems)
        invalid(`${path} has too many items`);
      if (schema.items)
        value.forEach((entry, index) =>
          validate(entry, schema.items!, `${path}[${index}]`)
        );
      break;
  }
  if (schema.enum && !schema.enum.includes(value))
    invalid(`${path} must be one of: ${schema.enum.join(', ')}`);
}

/** Stable object ordering makes versions and idempotency independent of JSON key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export async function recordVersion(record: unknown): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(record))
  );
  return Array.from(new Uint8Array(hash), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
