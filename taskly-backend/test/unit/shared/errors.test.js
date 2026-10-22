import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AlreadyExistsError,
  AuthenticationError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../src/shared/domain/errors.js';

describe('domain errors', () => {
  const cases = [
    [ValidationError, 'VALIDATION_ERROR'],
    [NotFoundError, 'NOT_FOUND'],
    [AlreadyExistsError, 'ALREADY_EXISTS'],
    [AuthenticationError, 'AUTHENTICATION_FAILED'],
    [ForbiddenError, 'FORBIDDEN'],
  ];

  for (const [ErrorClass, code] of cases) {
    it(`${ErrorClass.name} carries code ${code}`, () => {
      const error = new ErrorClass('boom');
      assert.ok(error instanceof DomainError);
      assert.ok(error instanceof Error);
      assert.equal(error.code, code);
      assert.equal(error.name, ErrorClass.name);
      assert.equal(error.message, 'boom');
    });
  }
});
