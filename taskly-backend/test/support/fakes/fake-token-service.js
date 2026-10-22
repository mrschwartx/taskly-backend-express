import { TokenService } from '../../../src/modules/users/domain/token-service.js';

const PREFIX = 'token-for-';

export class FakeTokenService extends TokenService {
  issue({ userId }) {
    return `${PREFIX}${userId}`;
  }

  verify(token) {
    if (!token.startsWith(PREFIX)) {
      throw new Error('Invalid token');
    }
    return { userId: token.slice(PREFIX.length) };
  }
}
