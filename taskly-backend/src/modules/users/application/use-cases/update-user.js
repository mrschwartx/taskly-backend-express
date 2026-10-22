import { parseEntityId } from '../../../../shared/domain/entity-id.js';
import {
  AlreadyExistsError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors.js';
import { Email } from '../../domain/value-objects/email.js';
import { PlainPassword } from '../../domain/value-objects/plain-password.js';
import { Username } from '../../domain/value-objects/username.js';
import { assertOwnAccount } from '../assert-own-account.js';
import { toUserDto } from '../user-dto.js';

const UPDATABLE_FIELDS = ['username', 'email', 'password'];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const pickUpdatableFields = (changes) => {
  if (!isPlainObject(changes)) {
    return {};
  }
  return Object.fromEntries(
    UPDATABLE_FIELDS.filter((field) => changes[field] !== undefined).map(
      (field) => [field, changes[field]]
    )
  );
};

export class UpdateUser {
  #userRepository;
  #passwordHasher;

  constructor({ userRepository, passwordHasher }) {
    this.#userRepository = userRepository;
    this.#passwordHasher = passwordHasher;
  }

  async execute({ requesterId, userId, changes }) {
    assertOwnAccount(
      requesterId,
      userId,
      'You can only update your own account'
    );
    const id = parseEntityId(userId, 'user');

    const input = pickUpdatableFields(changes);
    if (Object.keys(input).length === 0) {
      throw new ValidationError('No updatable fields provided');
    }

    const username =
      input.username !== undefined
        ? Username.create(input.username)
        : undefined;
    const email =
      input.email !== undefined ? Email.create(input.email) : undefined;
    const password =
      input.password !== undefined
        ? PlainPassword.create(input.password)
        : undefined;

    const user = await this.#userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found!');
    }

    if (username || email) {
      const taken = await this.#userRepository.existsByEmailOrUsername({
        email: email?.value,
        username: username?.value,
        excludeId: id,
      });
      if (taken) {
        throw new AlreadyExistsError(
          'Email or Username is already registered.'
        );
      }
    }

    const passwordHash = password
      ? await this.#passwordHasher.hash(password.value)
      : undefined;

    user.updateProfile({ username, email, passwordHash });

    const updated = await this.#userRepository.update(user);
    if (!updated) {
      throw new NotFoundError('User not found!');
    }
    return toUserDto(user);
  }
}
