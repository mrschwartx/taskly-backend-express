import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../../../src/shared/domain/errors.js';
import { Email } from '../../../../src/modules/users/domain/value-objects/email.js';
import { PlainPassword } from '../../../../src/modules/users/domain/value-objects/plain-password.js';
import { Username } from '../../../../src/modules/users/domain/value-objects/username.js';

describe('Email', () => {
  it('trims and keeps the casing', () => {
    assert.equal(Email.create('  John@Mail.com ').value, 'John@Mail.com');
  });

  it('rejects invalid values', () => {
    const invalid = ['', 'plain', 'a@b', '@mail.com', 'a b@mail.com', 42];
    for (const value of [...invalid, undefined]) {
      assert.throws(() => Email.create(value), ValidationError);
    }
  });

  it('rejects overly long addresses', () => {
    assert.throws(
      () => Email.create(`${'a'.repeat(250)}@mail.com`),
      ValidationError
    );
  });

  it('compares by value', () => {
    assert.ok(Email.create('a@mail.com').equals(Email.create('a@mail.com')));
    assert.ok(!Email.create('a@mail.com').equals(Email.create('b@mail.com')));
    assert.ok(!Email.create('a@mail.com').equals('a@mail.com'));
  });

  it('restores stored values without validation', () => {
    assert.equal(Email.restore('legacy').value, 'legacy');
  });
});

describe('Username', () => {
  it('trims valid usernames', () => {
    assert.equal(Username.create('  johndoe123 ').value, 'johndoe123');
  });

  it('enforces length boundaries', () => {
    assert.equal(Username.create('abc').value, 'abc');
    assert.equal(Username.create('a'.repeat(50)).value.length, 50);
    assert.throws(() => Username.create('ab'), ValidationError);
    assert.throws(() => Username.create('a'.repeat(51)), ValidationError);
  });

  it('rejects non strings', () => {
    assert.throws(() => Username.create(undefined), ValidationError);
    assert.throws(() => Username.create({ $ne: null }), ValidationError);
  });

  it('compares by value', () => {
    assert.ok(Username.create('johndoe').equals(Username.create('johndoe')));
    assert.ok(!Username.create('johndoe').equals(Username.create('janedoe')));
  });
});

describe('PlainPassword', () => {
  it('accepts passwords within bounds', () => {
    assert.equal(PlainPassword.create('P@ssword123').value, 'P@ssword123');
  });

  it('rejects short passwords', () => {
    assert.throws(() => PlainPassword.create('short'), /at least 8/);
  });

  it('rejects passwords above the bcrypt limit in bytes', () => {
    assert.throws(() => PlainPassword.create('a'.repeat(73)), /72 bytes/);
    assert.throws(() => PlainPassword.create('é'.repeat(37)), /72 bytes/);
  });

  it('rejects non strings', () => {
    assert.throws(() => PlainPassword.create(12345678), ValidationError);
    assert.throws(() => PlainPassword.create(undefined), ValidationError);
  });
});
