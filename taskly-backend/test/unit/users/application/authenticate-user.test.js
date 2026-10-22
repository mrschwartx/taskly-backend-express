import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { AuthenticateUser } from '../../../../src/modules/users/application/use-cases/authenticate-user.js';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import { buildUser } from '../../../support/builders.js';
import { FakePasswordHasher } from '../../../support/fakes/fake-password-hasher.js';
import { FakeTokenService } from '../../../support/fakes/fake-token-service.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';

describe('AuthenticateUser', () => {
  let authenticateUser;

  beforeEach(async () => {
    const userRepository = new InMemoryUserRepository();
    await userRepository.add(buildUser());
    authenticateUser = new AuthenticateUser({
      userRepository,
      passwordHasher: new FakePasswordHasher(),
      tokenService: new FakeTokenService(),
    });
  });

  it('returns the user and a token for valid credentials', async () => {
    const { user, token } = await authenticateUser.execute({
      email: 'johndoe123@mail.com',
      password: 'password123',
    });

    assert.equal(user.username, 'johndoe123');
    assert.equal(token, `token-for-${user._id}`);
    assert.equal('passwordHash' in user, false);
  });

  it('trims the email before lookup', async () => {
    const { user } = await authenticateUser.execute({
      email: '  johndoe123@mail.com  ',
      password: 'password123',
    });
    assert.equal(user.email, 'johndoe123@mail.com');
  });

  it('fails with not found for an unknown email', async () => {
    await assert.rejects(
      () =>
        authenticateUser.execute({
          email: 'ghost@mail.com',
          password: 'password123',
        }),
      (error) =>
        error instanceof NotFoundError && error.message === 'User not found!'
    );
  });

  it('fails with authentication error for a wrong password', async () => {
    await assert.rejects(
      () =>
        authenticateUser.execute({
          email: 'johndoe123@mail.com',
          password: 'wrong-password',
        }),
      (error) =>
        error instanceof AuthenticationError &&
        error.message === 'Wrong password!'
    );
  });

  it('rejects missing or non string credentials', async () => {
    const invalidInputs = [
      {},
      undefined,
      { email: 'johndoe123@mail.com' },
      { email: { $ne: null }, password: 'password123' },
      { email: 'johndoe123@mail.com', password: { $ne: null } },
    ];
    for (const input of invalidInputs) {
      await assert.rejects(
        () => authenticateUser.execute(input),
        ValidationError
      );
    }
  });
});
