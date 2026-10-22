import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { UpdateUser } from '../../../../src/modules/users/application/use-cases/update-user.js';
import { User } from '../../../../src/modules/users/domain/user.js';
import { Email } from '../../../../src/modules/users/domain/value-objects/email.js';
import { Username } from '../../../../src/modules/users/domain/value-objects/username.js';
import {
  AlreadyExistsError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import {
  buildUser,
  OTHER_USER_ID,
  USER_ID,
} from '../../../support/builders.js';
import { FakePasswordHasher } from '../../../support/fakes/fake-password-hasher.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';

describe('UpdateUser', () => {
  let userRepository;
  let updateUser;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    await userRepository.add(buildUser());
    await userRepository.add(
      User.register({
        id: OTHER_USER_ID,
        username: Username.create('jane78'),
        email: Email.create('jane@mail.com'),
        passwordHash: 'hashed:x',
      })
    );
    updateUser = new UpdateUser({
      userRepository,
      passwordHasher: new FakePasswordHasher(),
    });
  });

  const run = (changes, overrides = {}) =>
    updateUser.execute({
      requesterId: USER_ID,
      userId: USER_ID,
      changes,
      ...overrides,
    });

  it('updates username, email and password', async () => {
    const user = await run({
      username: 'renamed',
      email: 'renamed@mail.com',
      password: 'NewPassword1',
    });

    assert.equal(user.username, 'renamed');
    assert.equal(user.email, 'renamed@mail.com');
    assert.equal(
      userRepository.snapshots.get(USER_ID).passwordHash,
      'hashed:NewPassword1'
    );
    assert.equal('passwordHash' in user, false);
  });

  it('allows an update that keeps the current username and email', async () => {
    const user = await run({
      username: 'johndoe123',
      email: 'johndoe123@mail.com',
    });
    assert.equal(user.username, 'johndoe123');
  });

  it('ignores fields that are not updatable', async () => {
    const user = await run({
      username: 'renamed',
      avatar: '/images/users/hacked.png',
      _id: OTHER_USER_ID,
      createdAt: '1999-01-01T00:00:00.000Z',
    });

    const stored = userRepository.snapshots.get(USER_ID);
    assert.equal(user.avatar, '/images/users/default-avatar.jpg');
    assert.equal(stored.id, USER_ID);
    assert.equal(stored.createdAt, '2026-01-01T00:00:00.000Z');
  });

  it('rejects updating another account', async () => {
    await assert.rejects(
      () => run({ username: 'hijacked' }, { userId: OTHER_USER_ID }),
      (error) =>
        error instanceof AuthenticationError &&
        error.message === 'You can only update your own account'
    );
    assert.equal(
      userRepository.snapshots.get(OTHER_USER_ID).username,
      'jane78'
    );
  });

  it('rejects an empty or non updatable payload', async () => {
    for (const changes of [{}, { avatar: 'x.png' }, null, [], 'text']) {
      await assert.rejects(() => run(changes), ValidationError);
    }
  });

  it('rejects invalid values', async () => {
    await assert.rejects(() => run({ email: 'nope' }), ValidationError);
    await assert.rejects(() => run({ username: 'ab' }), ValidationError);
    await assert.rejects(() => run({ password: 'short' }), ValidationError);
  });

  it('rejects an email or username owned by someone else', async () => {
    await assert.rejects(
      () => run({ email: 'jane@mail.com' }),
      AlreadyExistsError
    );
    await assert.rejects(() => run({ username: 'jane78' }), AlreadyExistsError);
  });

  it('fails when the account no longer exists', async () => {
    await userRepository.deleteById(USER_ID);
    await assert.rejects(
      () => run({ username: 'renamed' }),
      (error) =>
        error instanceof NotFoundError && error.message === 'User not found!'
    );
  });

  it('accepts a mixed case user id for the owner', async () => {
    const user = await run(
      { username: 'renamed' },
      { userId: USER_ID.toUpperCase() }
    );
    assert.equal(user.username, 'renamed');
  });
});
