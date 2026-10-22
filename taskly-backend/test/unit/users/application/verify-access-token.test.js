import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VerifyAccessToken } from '../../../../src/modules/users/application/use-cases/verify-access-token.js';
import {
  AuthenticationError,
  ForbiddenError,
} from '../../../../src/shared/domain/errors.js';
import { FakeTokenService } from '../../../support/fakes/fake-token-service.js';

describe('VerifyAccessToken', () => {
  const verifyAccessToken = new VerifyAccessToken({
    tokenService: new FakeTokenService(),
  });

  it('returns the user id for a valid token', async () => {
    const result = await verifyAccessToken.execute({
      token: 'token-for-abc',
    });
    assert.deepEqual(result, { userId: 'abc' });
  });

  it('fails with authentication error when the token is missing', async () => {
    for (const input of [{}, undefined, { token: '' }]) {
      await assert.rejects(
        () => verifyAccessToken.execute(input),
        (error) =>
          error instanceof AuthenticationError &&
          error.message === 'Unauthorized: Token not provided'
      );
    }
  });

  it('fails with forbidden for an invalid token', async () => {
    await assert.rejects(
      () => verifyAccessToken.execute({ token: 'garbage' }),
      (error) =>
        error instanceof ForbiddenError &&
        error.message === 'Forbidden: Invalid token'
    );
  });
});
