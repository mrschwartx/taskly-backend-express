import { parseEntityId } from '../../../../shared/domain/entity-id.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors.js';
import { assertOwnAccount } from '../assert-own-account.js';
import { toUserDto } from '../user-dto.js';

export class ChangeUserAvatar {
  #userRepository;
  #avatarStorage;

  constructor({ userRepository, avatarStorage }) {
    this.#userRepository = userRepository;
    this.#avatarStorage = avatarStorage;
  }

  async execute({ requesterId, userId, avatarPath }) {
    try {
      assertOwnAccount(
        requesterId,
        userId,
        'You can only upload an avatar for your own account'
      );
      const id = parseEntityId(userId, 'user');

      if (!avatarPath) {
        throw new ValidationError('No file uploaded');
      }

      const user = await this.#userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User not found!');
      }

      const previousAvatar = user.avatar;
      user.changeAvatar(avatarPath);

      const updated = await this.#userRepository.update(user);
      if (!updated) {
        throw new NotFoundError('User not found!');
      }

      await this.#avatarStorage.remove(previousAvatar);
      return toUserDto(user);
    } catch (error) {
      if (avatarPath) {
        await this.#avatarStorage.remove(avatarPath);
      }
      throw error;
    }
  }
}
