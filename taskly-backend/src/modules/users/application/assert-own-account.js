import { AuthenticationError } from '../../../shared/domain/errors.js';

export const assertOwnAccount = (requesterId, userId, message) => {
  if (typeof userId !== 'string' || requesterId !== userId.toLowerCase()) {
    throw new AuthenticationError(message);
  }
};
