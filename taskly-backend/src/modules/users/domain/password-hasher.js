export class PasswordHasher {
  async hash() {
    throw new Error('PasswordHasher.hash is not implemented');
  }

  async compare() {
    throw new Error('PasswordHasher.compare is not implemented');
  }
}
