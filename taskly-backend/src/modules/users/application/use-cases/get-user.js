import { parseEntityId } from '../../../../shared/domain/entity-id.js';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { toUserDto } from '../user-dto.js';

export class GetUser {
  #userRepository;

  constructor({ userRepository }) {
    this.#userRepository = userRepository;
  }

  async execute({ userId }) {
    const id = parseEntityId(userId, 'user');
    const user = await this.#userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found!');
    }
    return toUserDto(user);
  }
}
