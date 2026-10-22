import { parseEntityId } from '../../../../shared/domain/entity-id.js';

export class DeleteTasksByOwner {
  #taskRepository;

  constructor({ taskRepository }) {
    this.#taskRepository = taskRepository;
  }

  async execute({ ownerId }) {
    const owner = parseEntityId(ownerId, 'user');
    return this.#taskRepository.deleteByOwner(owner);
  }
}
