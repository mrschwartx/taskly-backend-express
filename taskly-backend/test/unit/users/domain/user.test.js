import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_AVATAR_PATH,
  isCustomAvatar,
  toAvatarPath,
} from '../../../../src/modules/users/domain/avatar.js';
import { User } from '../../../../src/modules/users/domain/user.js';
import { Email } from '../../../../src/modules/users/domain/value-objects/email.js';
import { Username } from '../../../../src/modules/users/domain/value-objects/username.js';
import { buildUser, USER_ID } from '../../../support/builders.js';

describe('User', () => {
  it('registers with the default avatar and equal timestamps', () => {
    const user = buildUser();

    assert.equal(user.id, USER_ID);
    assert.equal(user.username.value, 'johndoe123');
    assert.equal(user.email.value, 'johndoe123@mail.com');
    assert.equal(user.avatar, DEFAULT_AVATAR_PATH);
    assert.equal(user.createdAt, '2026-01-01T00:00:00.000Z');
    assert.equal(user.updatedAt, user.createdAt);
  });

  it('updates only the provided profile fields and touches updatedAt', () => {
    const user = buildUser();

    user.updateProfile(
      { email: Email.create('new@mail.com') },
      new Date('2026-02-02T00:00:00.000Z')
    );

    assert.equal(user.email.value, 'new@mail.com');
    assert.equal(user.username.value, 'johndoe123');
    assert.equal(user.passwordHash, 'hashed:password123');
    assert.equal(user.updatedAt, '2026-02-02T00:00:00.000Z');
    assert.equal(user.createdAt, '2026-01-01T00:00:00.000Z');
  });

  it('can change username and password hash', () => {
    const user = buildUser();
    user.updateProfile({
      username: Username.create('renamed'),
      passwordHash: 'hashed:other',
    });
    assert.equal(user.username.value, 'renamed');
    assert.equal(user.passwordHash, 'hashed:other');
  });

  it('changes the avatar', () => {
    const user = buildUser();
    user.changeAvatar(
      '/images/users/avatar-1-2.png',
      new Date('2026-03-03T00:00:00.000Z')
    );
    assert.equal(user.avatar, '/images/users/avatar-1-2.png');
    assert.equal(user.updatedAt, '2026-03-03T00:00:00.000Z');
  });

  it('round trips through snapshots', () => {
    const user = buildUser();
    const restored = User.restore(user.toSnapshot());
    assert.deepEqual(restored.toSnapshot(), user.toSnapshot());
  });

  it('restores legacy data that would fail current validation', () => {
    const restored = User.restore({
      ...buildUser().toSnapshot(),
      username: 'ab',
      email: 'legacy',
    });
    assert.equal(restored.username.value, 'ab');
  });
});

describe('avatar helpers', () => {
  it('recognizes only uploaded avatars as custom', () => {
    assert.equal(
      isCustomAvatar('/images/users/avatar-1733654028168-119000846.jpeg'),
      true
    );
    assert.equal(isCustomAvatar(DEFAULT_AVATAR_PATH), false);
    assert.equal(isCustomAvatar('/images/users/../../etc/passwd'), false);
    assert.equal(isCustomAvatar('/images/users/avatar-1/../../x'), false);
    assert.equal(isCustomAvatar(undefined), false);
  });

  it('builds public paths from filenames', () => {
    assert.equal(
      toAvatarPath('avatar-1-2.png'),
      '/images/users/avatar-1-2.png'
    );
  });
});
