import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DeleteUser } from '../../../../src/modules/users/application/use-cases/delete-user.js';
import {
  AuthenticationError,
  NotFoundError,
} from '../../../../src/shared/domain/errors.js';
import { USER_DELETED } from '../../../../src/shared/domain/integration-events.js';
import {
  buildUser,
  OTHER_USER_ID,
  USER_ID,
} from '../../../support/builders.js';
import { FakeAvatarStorage } from '../../../support/fakes/fake-avatar-storage.js';
import { InMemoryUserRepository } from '../../../support/fakes/in-memory-user-repository.js';
import { RecordingEventBus } from '../../../support/fakes/recording-event-bus.js';

describe('DeleteUser', () => {
  let userRepository;
  let avatarStorage;
  let eventBus;
  let deleteUser;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    avatarStorage = new FakeAvatarStorage();
    eventBus = new RecordingEventBus();
    const user = buildUser();
    user.changeAvatar('/images/users/avatar-1-2.png');
    await userRepository.add(user);
    deleteUser = new DeleteUser({ userRepository, avatarStorage, eventBus });
  });

  it('deletes the user, removes the avatar and publishes an event', async () => {
    await deleteUser.execute({ requesterId: USER_ID, userId: USER_ID });

    assert.equal(userRepository.snapshots.has(USER_ID), false);
    assert.deepEqual(avatarStorage.removed, ['/images/users/avatar-1-2.png']);
    assert.equal(eventBus.events.length, 1);
    assert.equal(eventBus.events[0].name, USER_DELETED);
    assert.equal(eventBus.events[0].payload.userId, USER_ID);
  });

  it('rejects deleting another account', async () => {
    await assert.rejects(
      () => deleteUser.execute({ requesterId: USER_ID, userId: OTHER_USER_ID }),
      (error) =>
        error instanceof AuthenticationError &&
        error.message === 'You can only delete your own account'
    );
    assert.equal(userRepository.snapshots.size, 1);
    assert.equal(eventBus.events.length, 0);
  });

  it('fails when the user does not exist', async () => {
    await userRepository.deleteById(USER_ID);

    await assert.rejects(
      () => deleteUser.execute({ requesterId: USER_ID, userId: USER_ID }),
      NotFoundError
    );
    assert.equal(eventBus.events.length, 0);
  });
});
