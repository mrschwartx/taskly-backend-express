import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DueDate } from '../../../../src/modules/tasks/domain/value-objects/due-date.js';
import { ValidationError } from '../../../../src/shared/domain/errors.js';

describe('DueDate', () => {
  it('normalizes accepted inputs to ISO 8601 in UTC', () => {
    assert.equal(
      DueDate.create('2026-12-08T10:00:00Z').value,
      '2026-12-08T10:00:00.000Z'
    );
    assert.equal(
      DueDate.create('2026-03-01T07:00:00+07:00').value,
      '2026-03-01T00:00:00.000Z'
    );
    assert.equal(
      DueDate.create(' 2026-03-01 ').value,
      '2026-03-01T00:00:00.000Z'
    );
  });

  it('rejects missing, blank and unparsable values', () => {
    for (const value of [undefined, null, 42, '', '   ', 'someday']) {
      assert.throws(() => DueDate.create(value), ValidationError);
    }
  });

  it('rejects years outside the range PostgreSQL stores reliably', () => {
    assert.throws(
      () => DueDate.create('0000-01-01T00:00:00Z'),
      ValidationError
    );
    assert.throws(
      () => DueDate.create('+010000-01-01T00:00:00Z'),
      ValidationError
    );
  });

  it('compares by value', () => {
    assert.equal(
      DueDate.create('2026-01-01').equals(DueDate.create('2026-01-01T00:00Z')),
      true
    );
  });
});
