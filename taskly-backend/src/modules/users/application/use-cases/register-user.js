import { AlreadyExistsError } from '../../../../shared/domain/errors.js';
import { User } from '../../domain/user.js';
import { Email } from '../../domain/value-objects/email.js';
import { PlainPassword } from '../../domain/value-objects/plain-password.js';
import { Username } from '../../domain/value-objects/username.js';
import { toUserDto } from '../user-dto.js';

export class RegisterUser {
  #userRepository;
  #passwordHasher;
  #tokenService;

  constructor({ userRepository, passwordHasher, tokenService }) {
    this.#userRepository = userRepository;
    this.#passwordHasher = passwordHasher;
    this.#tokenService = tokenService;
  }

  async execute({ username, email, password } = {}) {
    const usernameValue = Username.create(username);
    const emailValue = Email.create(email);
    const passwordValue = PlainPassword.create(password);

    const alreadyRegistered =
      await this.#userRepository.existsByEmailOrUsername({
        email: emailValue.value,
        username: usernameValue.value,
      });
    if (alreadyRegistered) {
      throw new AlreadyExistsError('Email or Username is already registered.');
    }

    const passwordHash = await this.#passwordHasher.hash(passwordValue.value);
    const user = User.register({
      id: this.#userRepository.nextId(),
      username: usernameValue,
      email: emailValue,
      passwordHash,
    });
    await this.#userRepository.add(user);

    return {
      user: toUserDto(user),
      token: this.#tokenService.issue({ userId: user.id }),
    };
  }
}
