import { parseEntityId } from '../../../../shared/domain/entity-id.js';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors.js';

export class DeleteTask {
  #taskRepository;

  constructor({ taskRepository }) {
    this.#taskRepository = taskRepository;
  }

  async execute({ requesterId, taskId }) {
    const id = parseEntityId(taskId, 'task');
    const task = await this.#taskRepository.findById(id);
    if (!task) {
      throw new NotFoundError('Task not found!');
    }
    if (!task.isOwnedBy(requesterId)) {
      throw new ForbiddenError('You are not authorized to delete this task');
    }

    const deleted = await this.#taskRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError('Task not found!');
    }
  }
}
