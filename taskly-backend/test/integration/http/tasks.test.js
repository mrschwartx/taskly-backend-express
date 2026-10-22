import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestMongo } from '../../support/mongo.js';
import {
  registerUser,
  startTestApp,
  taskPayload,
} from '../../support/test-app.js';

const MISSING_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';

describe('tasks over HTTP', () => {
  let mongo;
  let app;

  const signedInClient = async () => {
    const client = app.createClient();
    const { user } = await registerUser(client);
    return { client, user };
  };

  before(async () => {
    mongo = await startTestMongo();
    app = await startTestApp({ mongoUri: mongo.uri });
  });

  after(async () => {
    await app.stop();
    await mongo.stop();
  });

  it('requires authentication on every route', async () => {
    const client = app.createClient();
    const responses = await Promise.all([
      client.get(`/api/v1/tasks/${MISSING_ID}`),
      client.get(`/api/v1/tasks/user/${MISSING_ID}`),
      client.post('/api/v1/tasks/create', { json: taskPayload() }),
      client.patch(`/api/v1/tasks/${MISSING_ID}`, { json: {} }),
      client.delete(`/api/v1/tasks/${MISSING_ID}`),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 401);
    }
  });

  describe('POST /api/v1/tasks/create', () => {
    it('creates a task owned by the authenticated user', async () => {
      const { client, user } = await signedInClient();

      const response = await client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      assert.equal(response.status, 200);
      assert.match(response.body._id, /^[0-9a-f]{24}$/);
      assert.equal(response.body.owner, user._id);
      assert.equal(response.body.name, 'Read Atomic Habits');
      assert.equal(response.body.priority, 'not urgent');
      assert.equal(response.body.status, 'open');
      assert.equal(response.body.due, '2026-12-08T10:00:00Z');
      assert.equal(response.body.createdAt, response.body.updatedAt);
    });

    it('defaults the status and ignores a spoofed owner', async () => {
      const { client, user } = await signedInClient();
      const other = await signedInClient();
      const { status, ...withoutStatus } = taskPayload();

      const response = await client.post('/api/v1/tasks/create', {
        json: { ...withoutStatus, owner: other.user._id },
      });

      assert.equal(response.status, 200);
      assert.equal(status, 'open');
      assert.equal(response.body.status, 'open');
      assert.equal(response.body.owner, user._id);
    });

    it('rejects invalid payloads', async () => {
      const { client } = await signedInClient();
      const payloads = [
        {},
        taskPayload({ name: '' }),
        taskPayload({ due: 'someday' }),
        taskPayload({ priority: undefined }),
      ];
      for (const json of payloads) {
        const response = await client.post('/api/v1/tasks/create', { json });
        assert.equal(response.status, 400);
      }
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('returns the task to its owner', async () => {
      const { client } = await signedInClient();
      const created = await client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await client.get(`/api/v1/tasks/${created.body._id}`);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, created.body);
    });

    it('answers 403 for tasks of other users', async () => {
      const owner = await signedInClient();
      const intruder = await signedInClient();
      const created = await owner.client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await intruder.client.get(
        `/api/v1/tasks/${created.body._id}`
      );

      assert.equal(response.status, 403);
    });

    it('answers 404 for unknown ids and 400 for malformed ids', async () => {
      const { client } = await signedInClient();

      const unknown = await client.get(`/api/v1/tasks/${MISSING_ID}`);
      const malformed = await client.get('/api/v1/tasks/nope');

      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.message, 'Task not found!');
      assert.equal(malformed.status, 400);
    });
  });

  describe('GET /api/v1/tasks/user/:id', () => {
    it('paginates four tasks per page and reports the total', async () => {
      const { client, user } = await signedInClient();
      for (let index = 1; index <= 6; index += 1) {
        await client.post('/api/v1/tasks/create', {
          json: taskPayload({ name: `Task ${index}` }),
        });
      }

      const first = await client.get(`/api/v1/tasks/user/${user._id}`);
      const second = await client.get(`/api/v1/tasks/user/${user._id}?page=2`);

      assert.equal(first.status, 200);
      assert.equal(first.body.taskCount, 6);
      assert.equal(first.body.tasks.length, 4);
      assert.equal(second.body.tasks.length, 2);
      assert.deepEqual(
        [...first.body.tasks, ...second.body.tasks].map((task) => task.name),
        ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6']
      );
    });

    it('filters by status and orders by a field', async () => {
      const { client, user } = await signedInClient();
      await client.post('/api/v1/tasks/create', {
        json: taskPayload({ name: 'b-task', status: 'done' }),
      });
      await client.post('/api/v1/tasks/create', {
        json: taskPayload({ name: 'a-task', status: 'done' }),
      });
      await client.post('/api/v1/tasks/create', {
        json: taskPayload({ name: 'c-task', status: 'open' }),
      });

      const response = await client.get(
        `/api/v1/tasks/user/${user._id}?status=done&orderBy=name`
      );

      assert.equal(response.body.taskCount, 2);
      assert.deepEqual(
        response.body.tasks.map((task) => task.name),
        ['a-task', 'b-task']
      );
    });

    it('returns an empty page for a user without tasks', async () => {
      const { client, user } = await signedInClient();
      const response = await client.get(`/api/v1/tasks/user/${user._id}`);
      assert.deepEqual(response.body, { tasks: [], taskCount: 0 });
    });

    it('forbids reading the tasks of another user', async () => {
      const owner = await signedInClient();
      const intruder = await signedInClient();

      const response = await intruder.client.get(
        `/api/v1/tasks/user/${owner.user._id}`
      );

      assert.equal(response.status, 403);
    });

    it('rejects invalid query parameters', async () => {
      const { client, user } = await signedInClient();

      const badOrder = await client.get(
        `/api/v1/tasks/user/${user._id}?orderBy=owner`
      );
      const repeatedStatus = await client.get(
        `/api/v1/tasks/user/${user._id}?status=a&status=b`
      );
      const badId = await client.get('/api/v1/tasks/user/not-an-id');

      assert.equal(badOrder.status, 400);
      assert.equal(repeatedStatus.status, 400);
      assert.equal(badId.status, 400);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('updates the task', async () => {
      const { client } = await signedInClient();
      const created = await client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await client.patch(`/api/v1/tasks/${created.body._id}`, {
        json: {
          name: 'Read Atomic Habits - Updated',
          priority: 'urgent',
          status: 'in-progress',
          due: '2026-12-15T10:00:00Z',
        },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.name, 'Read Atomic Habits - Updated');
      assert.equal(response.body.status, 'in-progress');
      assert.equal(response.body.owner, created.body.owner);
      assert.equal(response.body.createdAt, created.body.createdAt);
      assert.ok(response.body.updatedAt >= created.body.updatedAt);
    });

    it('cannot transfer a task to another user', async () => {
      const owner = await signedInClient();
      const other = await signedInClient();
      const created = await owner.client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await owner.client.patch(
        `/api/v1/tasks/${created.body._id}`,
        { json: { name: 'Still mine', owner: other.user._id } }
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.owner, owner.user._id);
    });

    it('answers 403 for tasks of other users and leaves them untouched', async () => {
      const owner = await signedInClient();
      const intruder = await signedInClient();
      const created = await owner.client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await intruder.client.patch(
        `/api/v1/tasks/${created.body._id}`,
        { json: { name: 'Hacked' } }
      );
      const unchanged = await owner.client.get(
        `/api/v1/tasks/${created.body._id}`
      );

      assert.equal(response.status, 403);
      assert.equal(unchanged.body.name, 'Read Atomic Habits');
    });

    it('rejects empty and invalid updates', async () => {
      const { client } = await signedInClient();
      const created = await client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });
      const path = `/api/v1/tasks/${created.body._id}`;

      assert.equal((await client.patch(path, { json: {} })).status, 400);
      assert.equal(
        (await client.patch(path, { json: { due: 'never' } })).status,
        400
      );
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('deletes the task', async () => {
      const { client } = await signedInClient();
      const created = await client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await client.delete(`/api/v1/tasks/${created.body._id}`);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { message: 'Task has been deleted' });
      assert.equal(
        (await client.get(`/api/v1/tasks/${created.body._id}`)).status,
        404
      );
    });

    it('answers 403 for tasks of other users and keeps them', async () => {
      const owner = await signedInClient();
      const intruder = await signedInClient();
      const created = await owner.client.post('/api/v1/tasks/create', {
        json: taskPayload(),
      });

      const response = await intruder.client.delete(
        `/api/v1/tasks/${created.body._id}`
      );

      assert.equal(response.status, 403);
      assert.equal(
        (await owner.client.get(`/api/v1/tasks/${created.body._id}`)).status,
        200
      );
    });

    it('answers 404 for unknown tasks', async () => {
      const { client } = await signedInClient();
      const response = await client.delete(`/api/v1/tasks/${MISSING_ID}`);
      assert.equal(response.status, 404);
    });
  });

  describe('cross module behaviour', () => {
    it('removes the tasks of a deleted user and keeps everyone else’s', async () => {
      const leaving = await signedInClient();
      const staying = await signedInClient();
      for (const client of [leaving.client, leaving.client, staying.client]) {
        await client.post('/api/v1/tasks/create', { json: taskPayload() });
      }

      await leaving.client.delete(`/api/v1/users/delete/${leaving.user._id}`);

      const { listTasksByUser } = app.container.modules.tasks.useCases;
      const gone = await listTasksByUser.execute({
        requesterId: leaving.user._id,
        ownerId: leaving.user._id,
      });
      const kept = await staying.client.get(
        `/api/v1/tasks/user/${staying.user._id}`
      );

      assert.equal(gone.taskCount, 0);
      assert.equal(kept.body.taskCount, 1);
    });
  });
});
