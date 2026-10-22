import { ChangeUserAvatar } from './application/use-cases/change-user-avatar.js';
import { AuthenticateUser } from './application/use-cases/authenticate-user.js';
import { DeleteUser } from './application/use-cases/delete-user.js';
import { GetUser } from './application/use-cases/get-user.js';
import { ListUsers } from './application/use-cases/list-users.js';
import { RegisterUser } from './application/use-cases/register-user.js';
import { UpdateUser } from './application/use-cases/update-user.js';
import { VerifyAccessToken } from './application/use-cases/verify-access-token.js';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher.js';
import { JwtTokenService } from './infrastructure/jwt-token-service.js';
import { LocalAvatarStorage } from './infrastructure/local-avatar-storage.js';
import { MongoUserRepository } from './infrastructure/mongo-user-repository.js';
import { createAuthController } from './presentation/http/auth-controller.js';
import { createAuthCookie } from './presentation/http/auth-cookie.js';
import { createAuthRouter } from './presentation/http/auth-router.js';
import { createAuthenticate } from './presentation/http/authenticate.js';
import { createAvatarUpload } from './presentation/http/avatar-upload.js';
import { createUsersController } from './presentation/http/users-controller.js';
import { createUsersRouter } from './presentation/http/users-router.js';

export const createUsersModule = ({ db, config, logger, eventBus }) => {
  const userRepository = new MongoUserRepository({ db });
  const passwordHasher = new BcryptPasswordHasher({
    rounds: config.auth.bcryptRounds,
  });
  const tokenService = new JwtTokenService({
    secret: config.auth.secret,
    ttl: config.auth.tokenTtl,
  });
  const avatarStorage = new LocalAvatarStorage({
    publicDir: config.storage.publicDir,
    logger,
  });

  const useCases = {
    registerUser: new RegisterUser({
      userRepository,
      passwordHasher,
      tokenService,
    }),
    authenticateUser: new AuthenticateUser({
      userRepository,
      passwordHasher,
      tokenService,
    }),
    verifyAccessToken: new VerifyAccessToken({ tokenService }),
    getUser: new GetUser({ userRepository }),
    listUsers: new ListUsers({ userRepository }),
    updateUser: new UpdateUser({ userRepository, passwordHasher }),
    deleteUser: new DeleteUser({ userRepository, avatarStorage, eventBus }),
    changeUserAvatar: new ChangeUserAvatar({ userRepository, avatarStorage }),
  };

  const authCookie = createAuthCookie({
    auth: config.auth,
    isProduction: config.app.isProduction,
  });
  const authenticate = createAuthenticate({
    verifyAccessToken: useCases.verifyAccessToken,
    cookieName: config.auth.cookieName,
  });
  const uploadAvatar = createAvatarUpload({
    avatarsDir: config.storage.avatarsDir,
    maxBytes: config.storage.avatarMaxBytes,
  });

  const authRouter = createAuthRouter({
    controller: createAuthController({
      registerUser: useCases.registerUser,
      authenticateUser: useCases.authenticateUser,
      authCookie,
    }),
  });
  const usersRouter = createUsersRouter({
    controller: createUsersController({ ...useCases, authCookie }),
    authenticate,
    uploadAvatar,
  });

  return {
    authRouter,
    usersRouter,
    authenticate,
    useCases,
    initialize: () => userRepository.ensureIndexes(),
  };
};
