import fs from 'node:fs/promises';
import path from 'node:path';
import { AvatarStorage } from '../application/avatar-storage.js';
import { isCustomAvatar } from '../domain/avatar.js';

export class LocalAvatarStorage extends AvatarStorage {
  #publicDir;
  #logger;

  constructor({ publicDir, logger }) {
    super();
    this.#publicDir = publicDir;
    this.#logger = logger;
  }

  async remove(avatarPath) {
    if (!isCustomAvatar(avatarPath)) {
      return;
    }

    try {
      await fs.rm(path.join(this.#publicDir, avatarPath), { force: true });
    } catch (error) {
      this.#logger.warn('Failed to remove avatar file', {
        avatarPath,
        message: error.message,
      });
    }
  }
}
