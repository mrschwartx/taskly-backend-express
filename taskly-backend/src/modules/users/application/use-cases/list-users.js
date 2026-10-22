import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors.js';
import { toUserDto } from '../user-dto.js';

const assertOptionalString = (value, label) => {
  if (value !== undefined && typeof value !== 'string') {
    throw new ValidationError(`${label} filter must be a string`);
  }
};

export class ListUsers {
  #userRepository;

  constructor({ userRepository }) {
    this.#userRepository = userRepository;
  }

  async execute({ username, email } = {}) {
    assertOptionalString(username, 'Username');
    assertOptionalString(email, 'Email');

    const users = await this.#userRepository.search({ username, email });
    if (users.length === 0) {
      throw new NotFoundError('No users found');
    }
    return users.map(toUserDto);
  }
}
