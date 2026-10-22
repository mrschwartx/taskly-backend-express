import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { LocalAvatarStorage } from '../../../../src/modules/users/infrastructure/local-avatar-storage.js';
import { createSpyLogger } from '../../../support/silent-logger.js';
import {
  createTempPublicDir,
  removeDir,
} from '../../../support/test-config.js';

describe('LocalAvatarStorage', () => {
  let publicDir;
  let avatarsDir;
  let logger;
  let storage;

  before(() => {
    publicDir = createTempPublicDir();
    avatarsDir = path.join(publicDir, 'images', 'users');
    logger = createSpyLogger();
    storage = new LocalAvatarStorage({ publicDir, logger });
  });

  after(() => removeDir(publicDir));

  it('removes uploaded avatar files', async () => {
    const file = path.join(avatarsDir, 'avatar-1-2.png');
    fs.writeFileSync(file, 'data');

    await storage.remove('/images/users/avatar-1-2.png');

    assert.equal(fs.existsSync(file), false);
  });

  it('never removes the default avatar', async () => {
    await storage.remove('/images/users/default-avatar.jpg');
    assert.equal(
      fs.existsSync(path.join(avatarsDir, 'default-avatar.jpg')),
      true
    );
  });

  it('ignores paths that are not uploaded avatars', async () => {
    const outside = path.join(publicDir, 'secret.txt');
    fs.writeFileSync(outside, 'secret');

    await storage.remove('/../secret.txt');
    await storage.remove('/images/users/../../secret.txt');
    await storage.remove(undefined);

    assert.equal(fs.existsSync(outside), true);
  });

  it('does not fail when the file is already gone', async () => {
    await assert.doesNotReject(() =>
      storage.remove('/images/users/avatar-missing-0.png')
    );
  });

  it('logs a warning instead of throwing when removal fails', async () => {
    fs.mkdirSync(path.join(avatarsDir, 'avatar-directory-1'));

    await assert.doesNotReject(() =>
      storage.remove('/images/users/avatar-directory-1')
    );

    assert.ok(logger.entries.some((entry) => entry.level === 'warn'));
  });
});
