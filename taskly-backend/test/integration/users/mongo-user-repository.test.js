import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import { MongoUserRepository } from '../../../src/modules/users/infrastructure/mongo-user-repository.js';
import { User } from '../../../src/modules/users/domain/user.js';
import { Email } from '../../../src/modules/users/domain/value-objects/email.js';
import { Username } from '../../../src/modules/users/domain/value-objects/username.js';
import { AlreadyExistsError } from '../../../src/shared/domain/errors.js';
import { MongoConnection } from '../../../src/shared/infrastructure/mongo/mongo-connection.js';
import { startTestMongo } from '../../support/mongo.js';
import { randomDatabaseName } from '../../support/test-config.js';

describe('MongoUserRepository', () => {
  let mongo;
  let connection;
  let db;
  let repository;

  const newUser = (username, email) =>
    User.register({
      id: repository.nextId(),
      username: Username.create(username),
      email: Email.create(email),
      passwordHash: 'hash',
    });

  before(async () => {
    mongo = await startTestMongo();
    connection = new MongoConnection({
      uri: mongo.uri,
      db: randomDatabaseName(),
      timeoutMs: 5000,
    });
    db = await connection.connect();
    repository = new MongoUserRepository({ db });
    await repository.ensureIndexes();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
  });

  after(async () => {
    await db.dropDatabase();
    await connection.close();
    await mongo.stop();
  });

  it('generates valid object id strings', () => {
    assert.match(repository.nextId(), /^[0-9a-f]{24}$/);
    assert.notEqual(repository.nextId(), repository.nextId());
  });

  it('persists users with the legacy document shape', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    const document = await db
      .collection('users')
      .findOne({ _id: new ObjectId(user.id) });

    assert.equal(document.username, 'johndoe123');
    assert.equal(document.email, 'johndoe123@mail.com');
    assert.equal(document.password, 'hash');
    assert.equal(document.avatar, '/images/users/default-avatar.jpg');
    assert.equal(typeof document.createdAt, 'string');
    assert.equal(typeof document.updatedAt, 'string');
  });

  it('finds users by id and by email', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    const byId = await repository.findById(user.id);
    const byEmail = await repository.findByEmail('johndoe123@mail.com');

    assert.deepEqual(byId.toSnapshot(), user.toSnapshot());
    assert.equal(byEmail.id, user.id);
    assert.equal(await repository.findById(repository.nextId()), null);
    assert.equal(await repository.findByEmail('ghost@mail.com'), null);
  });

  it('falls back to the default avatar for legacy documents', async () => {
    const _id = new ObjectId();
    await db.collection('users').insertOne({
      _id,
      username: 'legacy',
      email: 'legacy@mail.com',
      password: 'hash',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    const user = await repository.findById(_id.toHexString());

    assert.equal(user.avatar, '/images/users/default-avatar.jpg');
  });

  it('enforces unique emails and usernames', async () => {
    await repository.add(newUser('johndoe123', 'johndoe123@mail.com'));

    await assert.rejects(
      () => repository.add(newUser('someoneelse', 'johndoe123@mail.com')),
      AlreadyExistsError
    );
    await assert.rejects(
      () => repository.add(newUser('johndoe123', 'other@mail.com')),
      AlreadyExistsError
    );
  });

  it('creates indexes idempotently', async () => {
    await assert.doesNotReject(() => repository.ensureIndexes());
    const names = (await db.collection('users').indexes()).map(
      (index) => index.name
    );
    assert.ok(names.includes('users_email_unique'));
    assert.ok(names.includes('users_username_unique'));
  });

  it('updates users and reports whether they exist', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    user.changeAvatar('/images/users/avatar-1-2.png');
    assert.equal(await repository.update(user), true);
    assert.equal(
      (await repository.findById(user.id)).avatar,
      '/images/users/avatar-1-2.png'
    );

    const ghost = newUser('ghost', 'ghost@mail.com');
    assert.equal(await repository.update(ghost), false);
  });

  it('rejects updates that collide with another user', async () => {
    await repository.add(newUser('jane78', 'jane@mail.com'));
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    user.updateProfile({ email: Email.create('jane@mail.com') });

    await assert.rejects(() => repository.update(user), AlreadyExistsError);
  });

  it('checks existence by email or username excluding a user', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    assert.equal(
      await repository.existsByEmailOrUsername({
        email: 'johndoe123@mail.com',
      }),
      true
    );
    assert.equal(
      await repository.existsByEmailOrUsername({ username: 'johndoe123' }),
      true
    );
    assert.equal(
      await repository.existsByEmailOrUsername({
        email: 'johndoe123@mail.com',
        username: 'johndoe123',
        excludeId: user.id,
      }),
      false
    );
    assert.equal(
      await repository.existsByEmailOrUsername({ email: 'free@mail.com' }),
      false
    );
    assert.equal(await repository.existsByEmailOrUsername({}), false);
  });

  it('searches case-insensitively by substring', async () => {
    await repository.add(newUser('johndoe123', 'johndoe123@mail.com'));
    await repository.add(newUser('jane78', 'jane@mail.com'));

    const byUsername = await repository.search({ username: 'JOHN' });
    const byEmail = await repository.search({ email: 'JANE@' });
    const all = await repository.search({});

    assert.deepEqual(
      byUsername.map((user) => user.username.value),
      ['johndoe123']
    );
    assert.deepEqual(
      byEmail.map((user) => user.username.value),
      ['jane78']
    );
    assert.equal(all.length, 2);
  });

  it('treats regular expression characters literally when searching', async () => {
    await repository.add(newUser('johndoe123', 'johndoe123@mail.com'));

    assert.equal((await repository.search({ username: '.*' })).length, 0);
    assert.equal((await repository.search({ username: '(' })).length, 0);
    assert.equal((await repository.search({ email: '^john' })).length, 0);
  });

  it('deletes users and reports whether they existed', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    assert.equal(await repository.deleteById(user.id), true);
    assert.equal(await repository.deleteById(user.id), false);
    assert.equal(await repository.findById(user.id), null);
  });
});
