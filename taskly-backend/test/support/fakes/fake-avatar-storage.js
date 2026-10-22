import { AvatarStorage } from '../../../src/modules/users/application/avatar-storage.js';

export class FakeAvatarStorage extends AvatarStorage {
  removed = [];

  async remove(avatarPath) {
    this.removed.push(avatarPath);
  }
}
