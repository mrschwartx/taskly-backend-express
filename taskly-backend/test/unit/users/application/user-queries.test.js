import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { GetUser } from '../../../../src/modules/users/application/use-cases/get-user.js';
import { ListUsers } from '../../../../src/modules/users/application/use-cases/list-users.js';
import { User } from '../../../../src/modules/users/domain/user.js';
import { Email } from '../../../../src/modules/users/domain/value-objects/email.js';
import { Username } from '../../../../src/modules/users/domain/value-objects/username.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import { buildUser, USER_ID } from '../../../support/builders.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';

describe('user queries', () => {
  let userRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    await userRepository.add(buildUser());
    await userRepository.add(
      User.register({
        id: 'dddddddddddddddddddddddd',
        username: Username.create('jane78'),
        email: Email.create('jane@mail.com'),
        passwordHash: 'hashed:x',
      })
    );
  });

  describe('GetUser', () => {
    it('returns a public view of the user', async () => {
      const user = await new GetUser({ userRepository }).execute({
        userId: USER_ID,
      });

      assert.equal(user._id, USER_ID);
      assert.equal(user.username, 'johndoe123');
      assert.equal('passwordHash' in user, false);
    });

    it('rejects malformed ids', async () => {
      await assert.rejects(
        () => new GetUser({ userRepository }).execute({ userId: 'nope' }),
        (error) =>
          error instanceof ValidationError &&
          error.message === 'Invalid user ID format'
      );
    });

    it('fails when the user does not exist', async () => {
      await assert.rejects(
        () =>
          new GetUser({ userRepository }).execute({
            userId: 'eeeeeeeeeeeeeeeeeeeeeeee',
          }),
        (error) =>
          error instanceof NotFoundError && error.message === 'User not found!'
      );
    });
  });

  describe('ListUsers', () => {
    it('returns all users when no filter is given', async () => {
      const users = await new ListUsers({ userRepository }).execute({});
      assert.equal(users.length, 2);
      assert.ok(users.every((user) => !('passwordHash' in user)));
    });

    it('filters by username case-insensitively', async () => {
      const users = await new ListUsers({ userRepository }).execute({
        username: 'JANE',
      });
      assert.deepEqual(
        users.map((user) => user.username),
        ['jane78']
      );
    });

    it('filters by email', async () => {
      const users = await new ListUsers({ userRepository }).execute({
        email: 'johndoe',
      });
      assert.equal(users.length, 1);
    });

    it('fails when nothing matches', async () => {
      await assert.rejects(
        () => new ListUsers({ userRepository }).execute({ username: 'zzz' }),
        (error) =>
          error instanceof NotFoundError && error.message === 'No users found'
      );
    });

    it('rejects non string filters', async () => {
      for (const filter of [{ username: ['a', 'b'] }, { email: { $ne: '' } }]) {
        await assert.rejects(
          () => new ListUsers({ userRepository }).execute(filter),
          ValidationError
        );
      }
    });
  });
});
