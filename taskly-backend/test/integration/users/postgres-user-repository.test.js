import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { User } from '../../../src/modules/users/domain/user.js';
import { Email } from '../../../src/modules/users/domain/value-objects/email.js';
import { Username } from '../../../src/modules/users/domain/value-objects/username.js';
import { PostgresUserRepository } from '../../../src/modules/users/infrastructure/postgres-user-repository.js';
import { AlreadyExistsError } from '../../../src/shared/domain/errors.js';
import { runMigrations } from '../../../src/shared/infrastructure/postgres/migrator.js';
import { PostgresConnection } from '../../../src/shared/infrastructure/postgres/postgres-connection.js';
import { startTestDatabase } from '../../support/postgres.js';

describe('PostgresUserRepository', () => {
  let database;
  let connection;
  let pool;
  let repository;

  const newUser = (username, email) =>
    User.register({
      id: repository.nextId(),
      username: Username.create(username),
      email: Email.create(email),
      passwordHash: 'hash',
    });

  before(async () => {
    database = await startTestDatabase();
    connection = new PostgresConnection({
      url: database.url,
      poolMax: 4,
      timeoutMs: 5000,
    });
    pool = await connection.connect();
    await runMigrations(pool);
    repository = new PostgresUserRepository({ pool });
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE users');
  });

  after(async () => {
    await connection.close();
    await database.stop();
  });

  it('generates unique valid UUIDs', () => {
    assert.match(
      repository.nextId(),
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
    );
    assert.notEqual(repository.nextId(), repository.nextId());
  });

  it('persists users in typed columns', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [
      user.id,
    ]);

    assert.equal(rows[0].username, 'johndoe123');
    assert.equal(rows[0].email, 'johndoe123@mail.com');
    assert.equal(rows[0].password_hash, 'hash');
    assert.equal(rows[0].avatar, '/images/users/default-avatar.jpg');
    assert.ok(rows[0].created_at instanceof Date);
    assert.ok(rows[0].updated_at instanceof Date);
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

  it('applies migrations idempotently', async () => {
    assert.deepEqual(await runMigrations(pool), []);

    const { rows } = await pool.query(
      'SELECT name FROM schema_migrations ORDER BY name'
    );
    assert.deepEqual(
      rows.map((row) => row.name),
      ['0001_create_users.sql', '0002_create_tasks.sql']
    );
  });

  it('creates unique indexes for email and username', async () => {
    const { rows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'users'"
    );
    const names = rows.map((row) => row.indexname);

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

  it('searches case-insensitively by substring in insertion order', async () => {
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
    assert.deepEqual(
      all.map((user) => user.username.value),
      ['johndoe123', 'jane78']
    );
  });

  it('treats pattern characters literally when searching', async () => {
    await repository.add(newUser('johndoe123', 'johndoe123@mail.com'));

    for (const term of ['.*', '(', '%', '_', '\\', 'john%']) {
      assert.equal(
        (await repository.search({ username: term })).length,
        0,
        `username ${term}`
      );
    }
    assert.equal((await repository.search({ email: '^john' })).length, 0);
    assert.equal((await repository.search({ username: 'john_oe' })).length, 0);
  });

  it('deletes users and reports whether they existed', async () => {
    const user = newUser('johndoe123', 'johndoe123@mail.com');
    await repository.add(user);

    assert.equal(await repository.deleteById(user.id), true);
    assert.equal(await repository.deleteById(user.id), false);
    assert.equal(await repository.findById(user.id), null);
  });
});
