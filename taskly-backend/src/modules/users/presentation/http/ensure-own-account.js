import { assertOwnAccount } from '../../application/assert-own-account.js';

export const ensureOwnAccount = (message) => (req, res, next) => {
  assertOwnAccount(req.auth.userId, req.params.id, message);
  next();
};
