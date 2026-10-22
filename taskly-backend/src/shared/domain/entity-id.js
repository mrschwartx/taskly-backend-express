import { ValidationError } from './errors.js';

const ENTITY_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isEntityId = (value) =>
  typeof value === 'string' && ENTITY_ID_PATTERN.test(value);

export const parseEntityId = (value, label) => {
  if (!isEntityId(value)) {
    throw new ValidationError(`Invalid ${label} ID format`);
  }
  return value.toLowerCase();
};
