import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEntityId,
  parseEntityId,
} from '../../../src/shared/domain/entity-id.js';
import { ValidationError } from '../../../src/shared/domain/errors.js';

describe('entity id', () => {
  it('accepts 24 character hex strings', () => {
    assert.equal(isEntityId('67553c6776ddd71b61bedc10'), true);
    assert.equal(isEntityId('67553C6776DDD71B61BEDC10'), true);
  });

  it('rejects everything else', () => {
    for (const value of ['', 'abc', 'g'.repeat(24), 123, null, undefined, {}]) {
      assert.equal(isEntityId(value), false);
    }
  });

  it('normalizes parsed ids to lower case', () => {
    assert.equal(
      parseEntityId('67553C6776DDD71B61BEDC10', 'user'),
      '67553c6776ddd71b61bedc10'
    );
  });

  it('throws a validation error with the label for invalid ids', () => {
    assert.throws(
      () => parseEntityId('nope', 'task'),
      (error) =>
        error instanceof ValidationError &&
        error.message === 'Invalid task ID format'
    );
  });
});
