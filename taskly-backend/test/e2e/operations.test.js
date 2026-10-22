import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestMongo } from '../support/mongo.js';
import {
  findFreePort,
  runNodeScript,
  startServerProcess,
} from '../support/server-process.js';
import { buildTestEnv } from '../support/test-config.js';

describe('e2e: operating the service', () => {
  let mongo;

  before(async () => {
    mongo = await startTestMongo();
  });

  after(async () => {
    await mongo.stop();
  });

  it('refuses to start without a valid AUTH_SECRET', async () => {
    const env = buildTestEnv({
      MONGO_URI: mongo.uri,
      APP_PORT: String(await findFreePort()),
      AUTH_SECRET: 'too-short',
    });

    const result = await runNodeScript('src/main.js', env);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /AUTH_SECRET must be at least 32 characters/);
  });

  it('refuses to start without MONGO_URI', async () => {
    const env = {
      ...buildTestEnv({ APP_PORT: String(await findFreePort()) }),
      MONGO_URI: '',
    };

    const result = await runNodeScript('src/main.js', env);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /MONGO_URI/);
  });

  it('exits with an error when MongoDB is unreachable', async () => {
    const env = buildTestEnv({
      MONGO_URI: 'mongodb://127.0.0.1:1',
      MONGO_TIMEOUT: '500',
      APP_PORT: String(await findFreePort()),
    });

    const result = await runNodeScript('src/main.js', env);

    assert.equal(result.code, 1);
  });

  it('exits with an error when the port is already taken', async () => {
    const running = await startServerProcess({ mongoUri: mongo.uri });
    try {
      const env = buildTestEnv({
        MONGO_URI: mongo.uri,
        APP_PORT: String(running.port),
      });

      const result = await runNodeScript('src/main.js', env);

      assert.equal(result.code, 1);
    } finally {
      await running.stop();
    }
  });

  describe('seeding', () => {
    it('seeds demo users idempotently so they can sign in', async () => {
      const server = await startServerProcess({ mongoUri: mongo.uri });
      try {
        const first = await runNodeScript('src/scripts/seed.js', server.env);
        const second = await runNodeScript('src/scripts/seed.js', server.env);

        assert.equal(first.code, 0);
        assert.equal(second.code, 0);

        const client = server.createClient();
        const signIn = await client.post('/api/v1/auth/signin', {
          json: { email: 'johndoe123@mail.com', password: 'password123' },
        });
        assert.equal(signIn.status, 200);

        const tasks = await client.get(`/api/v1/tasks/user/${signIn.body._id}`);
        assert.equal(tasks.body.taskCount, 1);
        assert.equal(tasks.body.tasks[0].name, 'Read Atomic Habits');

        const jane = await server.createClient().post('/api/v1/auth/signin', {
          json: { email: 'jane@mail.com', password: 'securepassword456' },
        });
        assert.equal(jane.status, 200);
      } finally {
        await server.stop();
      }
    });

    it('refuses to seed a production database', async () => {
      const env = buildTestEnv({
        MONGO_URI: mongo.uri,
        APP_LEVEL: 'production',
      });

      const result = await runNodeScript('src/scripts/seed.js', env);

      assert.equal(result.code, 1);
    });
  });
});
