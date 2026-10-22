import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AuthenticationError,
  ForbiddenError,
} from '../../../../src/shared/domain/errors.js';
import { VerifyAccessToken } from '../../../../src/modules/users/application/use-cases/verify-access-token.js';
import { createAuthCookie } from '../../../../src/modules/users/presentation/http/auth-cookie.js';
import { createAuthenticate } from '../../../../src/modules/users/presentation/http/authenticate.js';
import { ensureOwnAccount } from '../../../../src/modules/users/presentation/http/ensure-own-account.js';
import { FakeTokenService } from '../../../support/fakes/fake-token-service.js';

const auth = {
  cookieName: 'taskly_token',
  cookieMaxAgeMs: 3600000,
  cookieDomain: undefined,
};

const createResponse = () => {
  const calls = [];
  return {
    calls,
    cookie: (...args) => calls.push(['cookie', ...args]),
    clearCookie: (...args) => calls.push(['clearCookie', ...args]),
  };
};

describe('auth cookie', () => {
  it('uses lax, non secure cookies outside production', () => {
    const response = createResponse();
    createAuthCookie({ auth, isProduction: false }).set(response, 'jwt');

    const [, name, value, options] = response.calls[0];
    assert.equal(name, 'taskly_token');
    assert.equal(value, 'jwt');
    assert.deepEqual(options, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
      maxAge: 3600000,
    });
  });

  it('uses secure cross site cookies in production', () => {
    const response = createResponse();
    createAuthCookie({ auth, isProduction: true }).set(response, 'jwt');

    const options = response.calls[0][3];
    assert.equal(options.sameSite, 'none');
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
    assert.equal('domain' in options, false);
  });

  it('includes the configured domain in production', () => {
    const response = createResponse();
    createAuthCookie({
      auth: { ...auth, cookieDomain: '.example.com' },
      isProduction: true,
    }).set(response, 'jwt');

    assert.equal(response.calls[0][3].domain, '.example.com');
  });

  it('clears the cookie with the same attributes it was set with', () => {
    const response = createResponse();
    createAuthCookie({
      auth: { ...auth, cookieDomain: '.example.com' },
      isProduction: true,
    }).clear(response);

    const [action, name, options] = response.calls[0];
    assert.equal(action, 'clearCookie');
    assert.equal(name, 'taskly_token');
    assert.equal(options.domain, '.example.com');
    assert.equal(options.sameSite, 'none');
    assert.equal(options.secure, true);
  });
});

describe('authenticate middleware', () => {
  const authenticate = createAuthenticate({
    verifyAccessToken: new VerifyAccessToken({
      tokenService: new FakeTokenService(),
    }),
    cookieName: 'taskly_token',
  });

  it('attaches the authenticated user to the request', async () => {
    const request = { cookies: { taskly_token: 'token-for-abc' } };
    let nextCalled = false;

    await authenticate(request, {}, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(request.auth, { userId: 'abc' });
  });

  it('rejects requests without cookies', async () => {
    await assert.rejects(
      () => authenticate({}, {}, () => {}),
      AuthenticationError
    );
  });

  it('rejects invalid tokens', async () => {
    await assert.rejects(
      () => authenticate({ cookies: { taskly_token: 'bad' } }, {}, () => {}),
      ForbiddenError
    );
  });
});

describe('ensureOwnAccount middleware', () => {
  const middleware = ensureOwnAccount('Not yours');

  it('continues for the owner', () => {
    let nextCalled = false;
    middleware({ auth: { userId: 'abc' }, params: { id: 'ABC' } }, {}, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('throws for any other account', () => {
    assert.throws(
      () =>
        middleware(
          { auth: { userId: 'abc' }, params: { id: 'xyz' } },
          {},
          () => {}
        ),
      (error) =>
        error instanceof AuthenticationError && error.message === 'Not yours'
    );
  });
});
