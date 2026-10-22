import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ChangeUserAvatar } from '../../../../src/modules/users/application/use-cases/change-user-avatar.js';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import {
  buildUser,
  OTHER_USER_ID,
  USER_ID,
} from '../../../support/builders.js';
import { FakeAvatarStorage } from '../../../support/fakes/fake-avatar-storage.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';

describe('ChangeUserAvatar', () => {
  let userRepository;
  let avatarStorage;
  let changeUserAvatar;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    avatarStorage = new FakeAvatarStorage();
    await userRepository.add(buildUser());
    changeUserAvatar = new ChangeUserAvatar({ userRepository, avatarStorage });
  });

  it('stores the new avatar and removes the previous one', async () => {
    const user = await changeUserAvatar.execute({
      requesterId: USER_ID,
      userId: USER_ID,
      avatarPath: '/images/users/avatar-1-2.png',
    });

    assert.equal(user.avatar, '/images/users/avatar-1-2.png');
    assert.equal(
      userRepository.snapshots.get(USER_ID).avatar,
      '/images/users/avatar-1-2.png'
    );
    assert.deepEqual(avatarStorage.removed, [
      '/images/users/default-avatar.jpg',
    ]);
  });

  it('cleans up the uploaded file when the account is not the requester', async () => {
    await assert.rejects(
      () =>
        changeUserAvatar.execute({
          requesterId: USER_ID,
          userId: OTHER_USER_ID,
          avatarPath: '/images/users/avatar-9-9.png',
        }),
      AuthenticationError
    );
    assert.deepEqual(avatarStorage.removed, ['/images/users/avatar-9-9.png']);
  });

  it('cleans up the uploaded file when the user does not exist', async () => {
    await userRepository.deleteById(USER_ID);

    await assert.rejects(
      () =>
        changeUserAvatar.execute({
          requesterId: USER_ID,
          userId: USER_ID,
          avatarPath: '/images/users/avatar-9-9.png',
        }),
      NotFoundError
    );
    assert.deepEqual(avatarStorage.removed, ['/images/users/avatar-9-9.png']);
  });

  it('rejects requests without a file', async () => {
    await assert.rejects(
      () => changeUserAvatar.execute({ requesterId: USER_ID, userId: USER_ID }),
      (error) =>
        error instanceof ValidationError && error.message === 'No file uploaded'
    );
    assert.deepEqual(avatarStorage.removed, []);
  });
});
