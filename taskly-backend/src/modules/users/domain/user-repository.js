export class UserRepository {
  nextId() {
    throw new Error('UserRepository.nextId is not implemented');
  }

  async add() {
    throw new Error('UserRepository.add is not implemented');
  }

  async update() {
    throw new Error('UserRepository.update is not implemented');
  }

  async findById() {
    throw new Error('UserRepository.findById is not implemented');
  }

  async findByEmail() {
    throw new Error('UserRepository.findByEmail is not implemented');
  }

  async existsByEmailOrUsername() {
    throw new Error(
      'UserRepository.existsByEmailOrUsername is not implemented'
    );
  }

  async search() {
    throw new Error('UserRepository.search is not implemented');
  }

  async deleteById() {
    throw new Error('UserRepository.deleteById is not implemented');
  }
}
