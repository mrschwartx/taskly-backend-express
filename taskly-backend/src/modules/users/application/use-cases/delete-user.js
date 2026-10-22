import { parseEntityId } from '../../../../shared/domain/entity-id.js';
import { createDomainEvent } from '../../../../shared/domain/domain-event.js';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { USER_DELETED } from '../../../../shared/domain/integration-events.js';
import { assertOwnAccount } from '../assert-own-account.js';

export class DeleteUser {
  #userRepository;
  #avatarStorage;
  #eventBus;

  constructor({ userRepository, avatarStorage, eventBus }) {
    this.#userRepository = userRepository;
    this.#avatarStorage = avatarStorage;
    this.#eventBus = eventBus;
  }

  async execute({ requesterId, userId }) {
    assertOwnAccount(
      requesterId,
      userId,
      'You can only delete your own account'
    );
    const id = parseEntityId(userId, 'user');

    const user = await this.#userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found!');
    }

    const deleted = await this.#userRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError('User not found!');
    }

    await this.#avatarStorage.remove(user.avatar);
    await this.#eventBus.publish(
      createDomainEvent(USER_DELETED, { userId: id })
    );
  }
}
