import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createImageForm } from '../support/http-client.js';
import { startTestMongo } from '../support/mongo.js';
import { startServerProcess } from '../support/server-process.js';
import { taskPayload } from '../support/test-app.js';

describe('e2e: a full user journey against the real server process', () => {
  let mongo;
  let server;

  before(async () => {
    mongo = await startTestMongo();
    server = await startServerProcess({ mongoUri: mongo.uri });
  });

  after(async () => {
    if (server) {
      await server.stop();
    }
    await mongo.stop();
  });

  it('lets a person sign up, manage tasks, change profile and leave', async () => {
    const client = server.createClient();

    const signUp = await client.post('/api/v1/auth/signup', {
      json: {
        username: 'johndoe1',
        email: 'johndoe1@mail.com',
        password: 'P@ssword123',
      },
    });
    assert.equal(signUp.status, 200);
    const userId = signUp.body._id;

    const names = ['Read', 'Write', 'Review', 'Ship', 'Rest'];
    const createdIds = [];
    for (const name of names) {
      const created = await client.post('/api/v1/tasks/create', {
        json: taskPayload({ name }),
      });
      assert.equal(created.status, 200);
      createdIds.push(created.body._id);
    }

    const firstPage = await client.get(`/api/v1/tasks/user/${userId}`);
    const secondPage = await client.get(`/api/v1/tasks/user/${userId}?page=2`);
    assert.equal(firstPage.body.taskCount, 5);
    assert.equal(firstPage.body.tasks.length, 4);
    assert.equal(secondPage.body.tasks.length, 1);

    const updated = await client.patch(`/api/v1/tasks/${createdIds[0]}`, {
      json: { status: 'in-progress', priority: 'urgent' },
    });
    assert.equal(updated.body.status, 'in-progress');

    const inProgress = await client.get(
      `/api/v1/tasks/user/${userId}?status=in-progress`
    );
    assert.equal(inProgress.body.taskCount, 1);

    const removed = await client.delete(`/api/v1/tasks/${createdIds[1]}`);
    assert.equal(removed.status, 200);

    const upload = await client.post(`/api/v1/users/upload/${userId}`, {
      form: createImageForm(),
    });
    assert.equal(upload.status, 200);
    const image = await fetch(`${server.baseUrl}${upload.body.avatar}`);
    assert.equal(image.status, 200);

    const profile = await client.patch(`/api/v1/users/update/${userId}`, {
      json: { username: 'johndoe_renamed' },
    });
    assert.equal(profile.body.username, 'johndoe_renamed');
    assert.equal(profile.body.avatar, upload.body.avatar);

    const signOut = await client.get('/api/v1/auth/signout');
    assert.equal(signOut.status, 200);
    assert.equal(
      (await client.get(`/api/v1/tasks/${createdIds[0]}`)).status,
      401
    );

    const signIn = await client.post('/api/v1/auth/signin', {
      json: { email: 'johndoe1@mail.com', password: 'P@ssword123' },
    });
    assert.equal(signIn.status, 200);
    assert.equal(signIn.body.username, 'johndoe_renamed');

    const leave = await client.delete(`/api/v1/users/delete/${userId}`);
    assert.equal(leave.status, 200);
    assert.equal(
      (await fetch(`${server.baseUrl}${upload.body.avatar}`)).status,
      404
    );

    const again = await client.post('/api/v1/auth/signin', {
      json: { email: 'johndoe1@mail.com', password: 'P@ssword123' },
    });
    assert.equal(again.status, 404);
  });

  it('keeps two users completely isolated from each other', async () => {
    const alice = server.createClient();
    const bob = server.createClient();
    const aliceUser = (
      await alice.post('/api/v1/auth/signup', {
        json: {
          username: 'alice_e2e',
          email: 'alice@mail.com',
          password: 'AlicePass123',
        },
      })
    ).body;
    const bobUser = (
      await bob.post('/api/v1/auth/signup', {
        json: {
          username: 'bob_e2e',
          email: 'bob@mail.com',
          password: 'BobbyPass123',
        },
      })
    ).body;

    const aliceTask = (
      await alice.post('/api/v1/tasks/create', { json: taskPayload() })
    ).body;

    assert.equal((await bob.get(`/api/v1/tasks/${aliceTask._id}`)).status, 403);
    assert.equal(
      (await bob.get(`/api/v1/tasks/user/${aliceUser._id}`)).status,
      403
    );
    assert.equal(
      (
        await bob.patch(`/api/v1/tasks/${aliceTask._id}`, {
          json: { name: 'bob was here' },
        })
      ).status,
      403
    );
    assert.equal(
      (await bob.delete(`/api/v1/tasks/${aliceTask._id}`)).status,
      403
    );
    assert.equal(
      (
        await bob.patch(`/api/v1/users/update/${aliceUser._id}`, {
          json: { username: 'stolen' },
        })
      ).status,
      401
    );
    assert.equal(
      (await bob.delete(`/api/v1/users/delete/${aliceUser._id}`)).status,
      401
    );

    const untouched = await alice.get(`/api/v1/tasks/${aliceTask._id}`);
    assert.equal(untouched.body.name, aliceTask.name);
    assert.equal(
      (await bob.get(`/api/v1/tasks/user/${bobUser._id}`)).body.taskCount,
      0
    );
  });

  it('serves the default avatar and the welcome message', async () => {
    const client = server.createClient();
    const welcome = await client.get('/');
    const avatar = await fetch(
      `${server.baseUrl}/images/users/default-avatar.jpg`
    );

    assert.deepEqual(welcome.body, { message: 'Welcome to the Taskly API' });
    assert.equal(avatar.status, 200);
    assert.equal(avatar.headers.get('content-type'), 'image/jpeg');
  });

  it('shuts down gracefully on SIGTERM', async () => {
    const instance = await startServerProcess({ mongoUri: mongo.uri });
    const client = instance.createClient();
    assert.equal((await client.get('/')).status, 200);

    const result = await instance.stop('SIGTERM');

    assert.equal(result.code, 0);
    await assert.rejects(() => fetch(`${instance.baseUrl}/`));
  });
});
