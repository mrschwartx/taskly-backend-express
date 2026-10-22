import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../../../src/config/env.js';
import { buildTestEnv, TEST_AUTH_SECRET } from '../../support/test-config.js';

describe('loadConfig', () => {
  it('applies defaults for optional variables', () => {
    const config = loadConfig({
      AUTH_SECRET: TEST_AUTH_SECRET,
      MONGO_URI: 'mongodb://localhost:27017',
    });

    assert.equal(config.app.name, 'taskly-api');
    assert.equal(config.app.host, '0.0.0.0');
    assert.equal(config.app.port, 8080);
    assert.equal(config.app.isProduction, false);
    assert.equal(config.mongo.db, 'taskly');
    assert.equal(config.mongo.timeoutMs, 30000);
    assert.equal(config.clientUrl, 'http://localhost:3000');
    assert.equal(config.auth.bcryptRounds, 10);
    assert.equal(config.auth.cookieName, 'taskly_token');
    assert.equal(config.logging.level, 'debug');
    assert.equal(config.logging.toFile, true);
  });

  it('reads overrides and parses numbers and booleans', () => {
    const config = loadConfig(
      buildTestEnv({
        APP_PORT: '9001',
        APP_LEVEL: 'production',
        MONGO_TIMEOUT: '1500',
        BCRYPT_ROUNDS: '12',
        LOG_TO_FILE: 'yes',
        COOKIE_DOMAIN: '.example.com',
      })
    );

    assert.equal(config.app.port, 9001);
    assert.equal(config.app.isProduction, true);
    assert.equal(config.mongo.timeoutMs, 1500);
    assert.equal(config.auth.bcryptRounds, 12);
    assert.equal(config.auth.cookieDomain, '.example.com');
    assert.equal(config.logging.toFile, true);
    assert.equal(config.logging.level, 'info');
  });

  it('falls back to defaults for invalid numbers', () => {
    const config = loadConfig(buildTestEnv({ APP_PORT: 'abc' }));
    assert.equal(config.app.port, 8080);
  });

  it('treats an empty cookie domain as unset', () => {
    const config = loadConfig(buildTestEnv({ COOKIE_DOMAIN: '' }));
    assert.equal(config.auth.cookieDomain, undefined);
  });

  it('derives the avatars directory from the public directory', () => {
    const config = loadConfig(
      buildTestEnv({ PUBLIC_DIR: '/tmp/taskly-public' })
    );
    assert.equal(config.storage.publicDir, '/tmp/taskly-public');
    assert.equal(config.storage.avatarsDir, '/tmp/taskly-public/images/users');
    assert.equal(config.storage.avatarMaxBytes, 2 * 1024 * 1024);
  });

  it('throws when AUTH_SECRET is missing', () => {
    assert.throws(
      () => loadConfig({ MONGO_URI: 'mongodb://localhost' }),
      /AUTH_SECRET/
    );
  });

  it('throws when AUTH_SECRET is too short', () => {
    assert.throws(
      () => loadConfig(buildTestEnv({ AUTH_SECRET: 'short' })),
      /at least 32 characters/
    );
  });

  it('throws when MONGO_URI is missing', () => {
    assert.throws(
      () => loadConfig({ AUTH_SECRET: TEST_AUTH_SECRET }),
      /MONGO_URI/
    );
  });

  it('returns an immutable object', () => {
    const config = loadConfig(buildTestEnv());
    assert.throws(() => {
      config.clientUrl = 'http://evil.test';
    }, TypeError);
  });
});
