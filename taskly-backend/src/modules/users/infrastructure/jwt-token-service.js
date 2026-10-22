import jwt from 'jsonwebtoken';
import { isEntityId } from '../../../shared/domain/entity-id.js';
import { TokenService } from '../domain/token-service.js';

const ALGORITHM = 'HS256';

export class JwtTokenService extends TokenService {
  #secret;
  #ttl;

  constructor({ secret, ttl }) {
    super();
    this.#secret = secret;
    this.#ttl = ttl;
  }

  issue({ userId }) {
    return jwt.sign({ id: userId }, this.#secret, {
      algorithm: ALGORITHM,
      expiresIn: this.#ttl,
    });
  }

  verify(token) {
    const payload = jwt.verify(token, this.#secret, {
      algorithms: [ALGORITHM],
    });
    if (!isEntityId(payload?.id)) {
      throw new Error('Invalid token payload');
    }
    return { userId: payload.id.toLowerCase() };
  }
}
