import { generateEntityId } from '../../../src/shared/domain/entity-id.js';
import { Task } from '../../../src/modules/tasks/domain/task.js';
import { TaskRepository } from '../../../src/modules/tasks/domain/task-repository.js';

export class InMemoryTaskRepository extends TaskRepository {
  snapshots = new Map();

  nextId() {
    return generateEntityId();
  }

  async add(task) {
    const snapshot = task.toSnapshot();
    this.snapshots.set(snapshot.id, snapshot);
  }

  async update(task) {
    const snapshot = task.toSnapshot();
    if (!this.snapshots.has(snapshot.id)) {
      return false;
    }
    this.snapshots.set(snapshot.id, snapshot);
    return true;
  }

  async findById(id) {
    const snapshot = this.snapshots.get(id);
    return snapshot ? Task.restore(snapshot) : null;
  }

  async findByOwner({ ownerId, status, orderBy, page, pageSize }) {
    const matching = [...this.snapshots.values()]
      .filter(
        (stored) =>
          stored.ownerId === ownerId && (!status || stored.status === status)
      )
      .sort((a, b) =>
        orderBy ? String(a[orderBy]).localeCompare(String(b[orderBy])) : 0
      );
    const start = (page - 1) * pageSize;
    return {
      tasks: matching
        .slice(start, start + pageSize)
        .map((stored) => Task.restore(stored)),
      total: matching.length,
    };
  }

  async deleteById(id) {
    return this.snapshots.delete(id);
  }

  async deleteByOwner(ownerId) {
    let deleted = 0;
    for (const [id, stored] of this.snapshots) {
      if (stored.ownerId === ownerId) {
        this.snapshots.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}
