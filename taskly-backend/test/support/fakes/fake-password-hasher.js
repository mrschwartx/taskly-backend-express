import { PasswordHasher } from '../../../src/modules/users/domain/password-hasher.js';

export class FakePasswordHasher extends PasswordHasher {
  async hash(plain) {
    return `hashed:${plain}`;
  }

  async compare(plain, hash) {
    return hash === `hashed:${plain}`;
  }
}
