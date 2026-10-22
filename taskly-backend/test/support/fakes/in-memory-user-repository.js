import crypto from 'node:crypto';
import { AlreadyExistsError } from '../../../src/shared/domain/errors.js';
import { User } from '../../../src/modules/users/domain/user.js';
import { UserRepository } from '../../../src/modules/users/domain/user-repository.js';

export class InMemoryUserRepository extends UserRepository {
  snapshots = new Map();

  nextId() {
    return crypto.randomBytes(12).toString('hex');
  }

  async add(user) {
    const snapshot = user.toSnapshot();
    const duplicate = [...this.snapshots.values()].some(
      (stored) =>
        stored.email === snapshot.email || stored.username === snapshot.username
    );
    if (duplicate) {
      throw new AlreadyExistsError('Email or Username is already registered.');
    }
    this.snapshots.set(snapshot.id, snapshot);
  }

  async update(user) {
    const snapshot = user.toSnapshot();
    if (!this.snapshots.has(snapshot.id)) {
      return false;
    }
    this.snapshots.set(snapshot.id, snapshot);
    return true;
  }

  async findById(id) {
    const snapshot = this.snapshots.get(id);
    return snapshot ? User.restore(snapshot) : null;
  }

  async findByEmail(email) {
    const snapshot = [...this.snapshots.values()].find(
      (stored) => stored.email === email
    );
    return snapshot ? User.restore(snapshot) : null;
  }

  async existsByEmailOrUsername({ email, username, excludeId }) {
    return [...this.snapshots.values()].some(
      (stored) =>
        stored.id !== excludeId &&
        ((email !== undefined && stored.email === email) ||
          (username !== undefined && stored.username === username))
    );
  }

  async search({ username, email } = {}) {
    return [...this.snapshots.values()]
      .filter(
        (stored) =>
          (!username ||
            stored.username.toLowerCase().includes(username.toLowerCase())) &&
          (!email || stored.email.toLowerCase().includes(email.toLowerCase()))
      )
      .map((stored) => User.restore(stored));
  }

  async deleteById(id) {
    return this.snapshots.delete(id);
  }
}
