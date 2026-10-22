import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RegisterUser } from '../../../../src/modules/users/application/use-cases/register-user.js';
import {
  AlreadyExistsError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import { FakePasswordHasher } from '../../../support/fakes/fake-password-hasher.js';
import { FakeTokenService } from '../../../support/fakes/fake-token-service.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';

describe('RegisterUser', () => {
  let userRepository;
  let registerUser;

  const validInput = {
    username: 'johndoe123',
    email: 'johndoe123@mail.com',
    password: 'P@ssword123',
  };

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    registerUser = new RegisterUser({
      userRepository,
      passwordHasher: new FakePasswordHasher(),
      tokenService: new FakeTokenService(),
    });
  });

  it('registers a user and returns a public view with a token', async () => {
    const { user, token } = await registerUser.execute(validInput);

    assert.equal(user.username, 'johndoe123');
    assert.equal(user.email, 'johndoe123@mail.com');
    assert.equal(user.avatar, '/images/users/default-avatar.jpg');
    assert.match(user._id, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    assert.equal(token, `token-for-${user._id}`);
    assert.equal('password' in user, false);
    assert.equal('passwordHash' in user, false);
  });

  it('stores only the hashed password', async () => {
    const { user } = await registerUser.execute(validInput);
    const stored = userRepository.snapshots.get(user._id);

    assert.equal(stored.passwordHash, 'hashed:P@ssword123');
    assert.notEqual(stored.passwordHash, validInput.password);
  });

  it('rejects an already registered email', async () => {
    await registerUser.execute(validInput);

    await assert.rejects(
      () => registerUser.execute({ ...validInput, username: 'someoneelse' }),
      (error) =>
        error instanceof AlreadyExistsError &&
        error.message === 'Email or Username is already registered.'
    );
  });

  it('rejects an already registered username', async () => {
    await registerUser.execute(validInput);

    await assert.rejects(
      () => registerUser.execute({ ...validInput, email: 'other@mail.com' }),
      AlreadyExistsError
    );
  });

  it('rejects invalid input without persisting anything', async () => {
    const invalidInputs = [
      { ...validInput, email: 'not-an-email' },
      { ...validInput, username: 'ab' },
      { ...validInput, password: 'short' },
      { ...validInput, password: undefined },
      { email: validInput.email },
      undefined,
    ];

    for (const input of invalidInputs) {
      await assert.rejects(() => registerUser.execute(input), ValidationError);
    }
    assert.equal(userRepository.snapshots.size, 0);
  });

  it('rejects operator objects posing as strings', async () => {
    await assert.rejects(
      () => registerUser.execute({ ...validInput, email: { $ne: null } }),
      ValidationError
    );
  });
});
