import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BcryptPasswordHasher } from '../../../../src/modules/users/infrastructure/bcrypt-password-hasher.js';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher({ rounds: 4 });

  it('produces a salted hash that is not the plain password', async () => {
    const first = await hasher.hash('P@ssword123');
    const second = await hasher.hash('P@ssword123');

    assert.notEqual(first, 'P@ssword123');
    assert.notEqual(first, second);
    assert.match(first, /^\$2[aby]\$04\$/);
  });

  it('verifies the right password only', async () => {
    const hash = await hasher.hash('P@ssword123');

    assert.equal(await hasher.compare('P@ssword123', hash), true);
    assert.equal(await hasher.compare('wrong-password', hash), false);
  });
});
