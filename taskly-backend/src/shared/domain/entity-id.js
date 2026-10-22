import crypto from 'node:crypto';
import { ValidationError } from './errors.js';

const ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const generateEntityId = () => crypto.randomUUID();

export const isEntityId = (value) =>
  typeof value === 'string' && ENTITY_ID_PATTERN.test(value);

export const parseEntityId = (value, label) => {
  if (!isEntityId(value)) {
    throw new ValidationError(`Invalid ${label} ID format`);
  }
  return value.toLowerCase();
};
