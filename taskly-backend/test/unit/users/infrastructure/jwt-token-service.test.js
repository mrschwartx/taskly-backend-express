import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { JwtTokenService } from '../../../../src/modules/users/infrastructure/jwt-token-service.js';
import { TEST_AUTH_SECRET } from '../../../support/test-config.js';
import { USER_ID } from '../../../support/builders.js';

describe('JwtTokenService', () => {
  const service = new JwtTokenService({ secret: TEST_AUTH_SECRET, ttl: '1h' });

  it('issues tokens that verify back to the user id', () => {
    const token = service.issue({ userId: USER_ID });
    assert.deepEqual(service.verify(token), { userId: USER_ID });
  });

  it('issues tokens that expire', () => {
    const payload = jwt.decode(service.issue({ userId: USER_ID }));
    assert.equal(payload.exp - payload.iat, 3600);
  });

  it('rejects tokens signed with another secret', () => {
    const forged = jwt.sign(
      { id: USER_ID },
      'another-secret-another-secret-1234'
    );
    assert.throws(() => service.verify(forged));
  });

  it('rejects tampered tokens', () => {
    const token = service.issue({ userId: USER_ID });
    const [header, , signature] = token.split('.');
    const body = Buffer.from(
      JSON.stringify({ id: 'ffffffffffffffffffffffff' })
    ).toString('base64url');
    assert.throws(() => service.verify(`${header}.${body}.${signature}`));
  });

  it('rejects expired tokens', () => {
    const expired = jwt.sign({ id: USER_ID }, TEST_AUTH_SECRET, {
      expiresIn: -10,
    });
    assert.throws(() => service.verify(expired), /expired/);
  });

  it('rejects unsigned tokens', () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify({ id: USER_ID })).toString(
      'base64url'
    );
    assert.throws(() => service.verify(`${header}.${body}.`));
  });

  it('rejects tokens signed with an unexpected algorithm', () => {
    const token = jwt.sign({ id: USER_ID }, TEST_AUTH_SECRET, {
      algorithm: 'HS512',
    });
    assert.throws(() => service.verify(token));
  });

  it('rejects tokens whose payload has no valid user id', () => {
    for (const payload of [{}, { id: 'abc' }, { id: 42 }]) {
      const token = jwt.sign(payload, TEST_AUTH_SECRET);
      assert.throws(() => service.verify(token), /Invalid token payload/);
    }
  });
});
