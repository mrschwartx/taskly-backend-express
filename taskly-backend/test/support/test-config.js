import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/config/env.js';

export const TEST_AUTH_SECRET = 'test-secret-value-with-more-than-32-chars';

const DEFAULT_AVATAR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/images/users/default-avatar.jpg'
);

export const randomDatabaseName = () =>
  `taskly_test_${crypto.randomBytes(5).toString('hex')}`;

export const createTempPublicDir = () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskly-public-'));
  const avatarsDir = path.join(publicDir, 'images', 'users');
  fs.mkdirSync(avatarsDir, { recursive: true });
  fs.copyFileSync(DEFAULT_AVATAR, path.join(avatarsDir, 'default-avatar.jpg'));
  return publicDir;
};

export const removeDir = (dir) =>
  fs.rmSync(dir, { recursive: true, force: true });

export const buildTestEnv = (overrides = {}) => ({
  AUTH_SECRET: TEST_AUTH_SECRET,
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  MONGO_DB: randomDatabaseName(),
  APP_HOST: '127.0.0.1',
  APP_PORT: '0',
  BCRYPT_ROUNDS: '4',
  LOG_SILENT: 'true',
  LOG_TO_FILE: 'false',
  ...overrides,
});

export const createTestConfig = (overrides = {}) =>
  loadConfig(buildTestEnv(overrides));
