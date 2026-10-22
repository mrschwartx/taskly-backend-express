export class TaskRepository {
  nextId() {
    throw new Error('TaskRepository.nextId is not implemented');
  }

  async add() {
    throw new Error('TaskRepository.add is not implemented');
  }

  async update() {
    throw new Error('TaskRepository.update is not implemented');
  }

  async findById() {
    throw new Error('TaskRepository.findById is not implemented');
  }

  async findByOwner() {
    throw new Error('TaskRepository.findByOwner is not implemented');
  }

  async deleteById() {
    throw new Error('TaskRepository.deleteById is not implemented');
  }

  async deleteByOwner() {
    throw new Error('TaskRepository.deleteByOwner is not implemented');
  }
}
