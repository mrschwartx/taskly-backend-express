import bcrypt from 'bcrypt';
import { PasswordHasher } from '../domain/password-hasher.js';

export class BcryptPasswordHasher extends PasswordHasher {
  #rounds;

  constructor({ rounds }) {
    super();
    this.#rounds = rounds;
  }

  hash(plain) {
    return bcrypt.hash(plain, this.#rounds);
  }

  compare(plain, hash) {
    return bcrypt.compare(plain, hash);
  }
}
