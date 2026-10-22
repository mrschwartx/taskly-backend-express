import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createImageForm } from '../../support/http-client.js';
import { startTestDatabase } from '../../support/postgres.js';
import { registerUser, startTestApp } from '../../support/test-app.js';

const MISSING_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('auth and users over HTTP', () => {
  let database;
  let app;

  const avatarFiles = () =>
    fs
      .readdirSync(path.join(app.publicDir, 'images', 'users'))
      .filter((file) => file.startsWith('avatar-'));

  before(async () => {
    database = await startTestDatabase();
    app = await startTestApp({ databaseUrl: database.url });
  });

  after(async () => {
    await app.stop();
    await database.stop();
  });

  describe('service basics', () => {
    it('greets on the root path', async () => {
      const response = await app.createClient().get('/');
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { message: 'Welcome to the Taskly API' });
    });

    it('responds with 404 for unknown routes', async () => {
      const response = await app.createClient().get('/api/v1/unknown');
      assert.equal(response.status, 404);
      assert.deepEqual(response.body, { message: 'Not found' });
    });

    it('responds with 400 for malformed JSON', async () => {
      const response = await app.createClient().post('/api/v1/auth/signin', {
        headers: { 'content-type': 'application/json' },
        form: '{broken',
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.message, 'Malformed JSON body');
    });

    it('does not advertise the framework', async () => {
      const response = await app.createClient().get('/');
      assert.equal(response.headers.get('x-powered-by'), null);
    });

    it('allows the configured client origin with credentials', async () => {
      const response = await fetch(`${app.baseUrl}/api/v1/auth/signin`, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
      assert.equal(
        response.headers.get('access-control-allow-origin'),
        'http://localhost:3000'
      );
      assert.equal(
        response.headers.get('access-control-allow-credentials'),
        'true'
      );
    });
  });

  describe('POST /api/v1/auth/signup', () => {
    it('creates a user and starts a session', async () => {
      const client = app.createClient();
      const { credentials, response } = await registerUser(client);

      assert.equal(response.status, 200);
      assert.equal(response.body.username, credentials.username);
      assert.equal(response.body.email, credentials.email);
      assert.equal(response.body.avatar, '/images/users/default-avatar.jpg');
      assert.match(
        response.body._id,
        /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
      );
      assert.equal('password' in response.body, false);
      assert.equal(client.hasCookie('taskly_token'), true);
    });

    it('sets an http only cookie', async () => {
      const { response } = await registerUser(app.createClient());
      const cookie = response.setCookie.find((value) =>
        value.startsWith('taskly_token=')
      );
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, /Max-Age=3600/i);
    });

    it('rejects duplicate emails and usernames with 422', async () => {
      const { credentials } = await registerUser(app.createClient());

      const sameEmail = await registerUser(app.createClient(), {
        email: credentials.email,
      });
      const sameUsername = await registerUser(app.createClient(), {
        username: credentials.username,
      });

      for (const { response } of [sameEmail, sameUsername]) {
        assert.equal(response.status, 422);
        assert.deepEqual(response.body, {
          status: 422,
          message: 'Email or Username is already registered.',
        });
      }
    });

    it('rejects invalid payloads with 400', async () => {
      const client = app.createClient();
      const payloads = [
        {},
        { username: 'ab', email: 'a@mail.com', password: 'Password123!' },
        { username: 'valid_user', email: 'nope', password: 'Password123!' },
        { username: 'valid_user', email: 'a@mail.com', password: 'short' },
      ];
      for (const json of payloads) {
        const response = await client.post('/api/v1/auth/signup', { json });
        assert.equal(response.status, 400);
      }
    });
  });

  describe('POST /api/v1/auth/signin', () => {
    it('signs in with valid credentials', async () => {
      const { credentials, user } = await registerUser(app.createClient());
      const client = app.createClient();

      const response = await client.post('/api/v1/auth/signin', {
        json: { email: credentials.email, password: credentials.password },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body._id, user._id);
      assert.equal(client.hasCookie('taskly_token'), true);
    });

    it('answers 404 for an unknown email', async () => {
      const response = await app.createClient().post('/api/v1/auth/signin', {
        json: { email: 'ghost@mail.com', password: 'Password123!' },
      });
      assert.equal(response.status, 404);
      assert.equal(response.body.message, 'User not found!');
    });

    it('answers 401 for a wrong password', async () => {
      const { credentials } = await registerUser(app.createClient());
      const response = await app.createClient().post('/api/v1/auth/signin', {
        json: { email: credentials.email, password: 'definitely-wrong' },
      });
      assert.equal(response.status, 401);
      assert.equal(response.body.message, 'Wrong password!');
    });

    it('rejects operator injection in credentials', async () => {
      await registerUser(app.createClient());
      const client = app.createClient();

      const response = await client.post('/api/v1/auth/signin', {
        json: { email: { $ne: null }, password: 'Password123!' },
      });

      assert.equal(response.status, 400);
      assert.equal(client.hasCookie('taskly_token'), false);
    });
  });

  describe('GET /api/v1/auth/signout', () => {
    it('clears the session cookie', async () => {
      const client = app.createClient();
      await registerUser(client);
      assert.equal(client.hasCookie('taskly_token'), true);

      const response = await client.get('/api/v1/auth/signout');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { message: 'Sign out successful' });
      assert.equal(client.hasCookie('taskly_token'), false);
      assert.equal((await client.get('/api/v1/users')).status, 401);
    });
  });

  describe('authentication guard', () => {
    it('answers 401 without a cookie', async () => {
      const response = await app.createClient().get('/api/v1/users');
      assert.equal(response.status, 401);
      assert.equal(response.body.message, 'Unauthorized: Token not provided');
    });

    it('answers 403 for an invalid token', async () => {
      const response = await app.createClient().get('/api/v1/users', {
        headers: { cookie: 'taskly_token=garbage' },
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.message, 'Forbidden: Invalid token');
    });

    it('protects every users route', async () => {
      const client = app.createClient();
      const requests = [
        client.get(`/api/v1/users/${MISSING_ID}`),
        client.patch(`/api/v1/users/update/${MISSING_ID}`, { json: {} }),
        client.post(`/api/v1/users/upload/${MISSING_ID}`),
        client.delete(`/api/v1/users/delete/${MISSING_ID}`),
      ];
      for (const response of await Promise.all(requests)) {
        assert.equal(response.status, 401);
      }
    });
  });

  describe('GET /api/v1/users', () => {
    it('lists and filters users without exposing passwords', async () => {
      const client = app.createClient();
      const { credentials } = await registerUser(client, {
        username: 'searchable_person',
      });

      const all = await client.get('/api/v1/users');
      const filtered = await client.get(
        '/api/v1/users?username=SEARCHABLE&email=' +
          encodeURIComponent(credentials.email)
      );

      assert.equal(all.status, 200);
      assert.ok(all.body.every((user) => !('password' in user)));
      assert.equal(filtered.body.length, 1);
      assert.equal(filtered.body[0].username, 'searchable_person');
    });

    it('answers 404 when nothing matches', async () => {
      const client = app.createClient();
      await registerUser(client);
      const response = await client.get(
        '/api/v1/users?username=no_such_user_xyz'
      );
      assert.equal(response.status, 404);
      assert.equal(response.body.message, 'No users found');
    });

    it('rejects repeated filter parameters', async () => {
      const client = app.createClient();
      await registerUser(client);
      const response = await client.get('/api/v1/users?username=a&username=b');
      assert.equal(response.status, 400);
    });

    it('does not treat filters as regular expressions', async () => {
      const client = app.createClient();
      await registerUser(client);
      const response = await client.get('/api/v1/users?username=.*');
      assert.equal(response.status, 404);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns the user', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);
      const response = await client.get(`/api/v1/users/${user._id}`);
      assert.equal(response.status, 200);
      assert.equal(response.body._id, user._id);
      assert.equal('password' in response.body, false);
    });

    it('answers 400 for malformed ids and 404 for unknown ids', async () => {
      const client = app.createClient();
      await registerUser(client);

      const malformed = await client.get('/api/v1/users/not-an-id');
      const unknown = await client.get(`/api/v1/users/${MISSING_ID}`);

      assert.equal(malformed.status, 400);
      assert.equal(malformed.body.message, 'Invalid user ID format');
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.message, 'User not found!');
    });
  });

  describe('PATCH /api/v1/users/update/:id', () => {
    it('updates the profile and lets the user sign in with the new password', async () => {
      const client = app.createClient();
      const { credentials, user } = await registerUser(client);
      const username = `renamed_${Date.now()}`;

      const response = await client.patch(`/api/v1/users/update/${user._id}`, {
        json: { username, password: 'BrandNewPassword1' },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.username, username);
      assert.equal('password' in response.body, false);

      const fresh = app.createClient();
      const oldLogin = await fresh.post('/api/v1/auth/signin', {
        json: { email: credentials.email, password: credentials.password },
      });
      const newLogin = await fresh.post('/api/v1/auth/signin', {
        json: { email: credentials.email, password: 'BrandNewPassword1' },
      });
      assert.equal(oldLogin.status, 401);
      assert.equal(newLogin.status, 200);
    });

    it('ignores the avatar field sent by clients', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);

      const response = await client.patch(`/api/v1/users/update/${user._id}`, {
        json: { username: `kept_${Date.now()}`, avatar: 'default-avatar.jpg' },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.avatar, '/images/users/default-avatar.jpg');
    });

    it('rejects updating another account with 401', async () => {
      const victim = await registerUser(app.createClient());
      const attacker = app.createClient();
      await registerUser(attacker);

      const response = await attacker.patch(
        `/api/v1/users/update/${victim.user._id}`,
        { json: { username: 'hijacked_name' } }
      );

      assert.equal(response.status, 401);
      assert.equal(
        response.body.message,
        'You can only update your own account'
      );
    });

    it('rejects colliding usernames with 422 and empty updates with 400', async () => {
      const first = await registerUser(app.createClient());
      const client = app.createClient();
      const { user } = await registerUser(client);

      const collision = await client.patch(`/api/v1/users/update/${user._id}`, {
        json: { username: first.credentials.username },
      });
      const empty = await client.patch(`/api/v1/users/update/${user._id}`, {
        json: {},
      });

      assert.equal(collision.status, 422);
      assert.equal(empty.status, 400);
    });
  });

  describe('POST /api/v1/users/upload/:id', () => {
    it('stores the avatar, serves it, and replaces the previous one', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);
      const before = avatarFiles().length;

      const first = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm(),
      });

      assert.equal(first.status, 200);
      assert.match(first.body.avatar, /^\/images\/users\/avatar-[\w-]+\.png$/);
      assert.equal(avatarFiles().length, before + 1);

      const served = await fetch(`${app.baseUrl}${first.body.avatar}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/png');
      assert.equal(served.headers.get('x-content-type-options'), 'nosniff');

      const second = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm({ type: 'image/jpeg', filename: 'next.jpg' }),
      });

      assert.equal(second.status, 200);
      assert.match(second.body.avatar, /\.jpg$/);
      assert.equal(avatarFiles().length, before + 1);
      assert.equal(
        (await fetch(`${app.baseUrl}${first.body.avatar}`)).status,
        404
      );
    });

    it('rejects non image uploads', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);
      const before = avatarFiles().length;

      const response = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm({ type: 'text/html', filename: 'xss.html' }),
      });

      assert.equal(response.status, 400);
      assert.match(response.body.message, /Only JPEG, PNG, WEBP and GIF/);
      assert.equal(avatarFiles().length, before);
    });

    it('rejects files above 2MB and leaves nothing on disk', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);
      const before = avatarFiles().length;

      const response = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm({ size: 2 * 1024 * 1024 + 1 }),
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.message, 'File size exceeds 2MB');
      assert.equal(avatarFiles().length, before);
    });

    it('rejects requests without a file', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);

      const response = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: new FormData(),
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.message, 'No file uploaded');
    });

    it('rejects uploads for another account before writing anything', async () => {
      const victim = await registerUser(app.createClient());
      const attacker = app.createClient();
      await registerUser(attacker);
      const before = avatarFiles().length;

      const response = await attacker.post(
        `/api/v1/users/upload/${victim.user._id}`,
        { form: createImageForm() }
      );

      assert.equal(response.status, 401);
      assert.equal(avatarFiles().length, before);
    });

    it('ignores a differently named file field', async () => {
      const client = app.createClient();
      const { user } = await registerUser(client);

      const response = await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm({ fieldName: 'photo' }),
      });

      assert.equal(response.status, 400);
    });
  });

  describe('DELETE /api/v1/users/delete/:id', () => {
    it('deletes the account, ends the session and removes the avatar', async () => {
      const client = app.createClient();
      const { credentials, user } = await registerUser(client);
      await client.post(`/api/v1/users/upload/${user._id}`, {
        form: createImageForm(),
      });
      const before = avatarFiles().length;

      const response = await client.delete(`/api/v1/users/delete/${user._id}`);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { message: 'User has been deleted' });
      assert.equal(client.hasCookie('taskly_token'), false);
      assert.equal(avatarFiles().length, before - 1);

      const login = await app.createClient().post('/api/v1/auth/signin', {
        json: { email: credentials.email, password: credentials.password },
      });
      assert.equal(login.status, 404);
    });

    it('rejects deleting another account with 401', async () => {
      const victim = await registerUser(app.createClient());
      const attacker = app.createClient();
      await registerUser(attacker);

      const response = await attacker.delete(
        `/api/v1/users/delete/${victim.user._id}`
      );

      assert.equal(response.status, 401);
      assert.equal(
        response.body.message,
        'You can only delete your own account'
      );
      const stillThere = await app.createClient().post('/api/v1/auth/signin', {
        json: {
          email: victim.credentials.email,
          password: victim.credentials.password,
        },
      });
      assert.equal(stillThere.status, 200);
    });
  });
});
