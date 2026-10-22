import { DEFAULT_AVATAR_PATH } from './avatar.js';
import { Email } from './value-objects/email.js';
import { Username } from './value-objects/username.js';

export class User {
  #id;
  #username;
  #email;
  #passwordHash;
  #avatar;
  #createdAt;
  #updatedAt;

  constructor({
    id,
    username,
    email,
    passwordHash,
    avatar,
    createdAt,
    updatedAt,
  }) {
    this.#id = id;
    this.#username = username;
    this.#email = email;
    this.#passwordHash = passwordHash;
    this.#avatar = avatar;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;
  }

  static register({ id, username, email, passwordHash, now = new Date() }) {
    const timestamp = now.toISOString();
    return new User({
      id,
      username,
      email,
      passwordHash,
      avatar: DEFAULT_AVATAR_PATH,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  static restore(snapshot) {
    return new User({
      id: snapshot.id,
      username: Username.restore(snapshot.username),
      email: Email.restore(snapshot.email),
      passwordHash: snapshot.passwordHash,
      avatar: snapshot.avatar,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  get id() {
    return this.#id;
  }

  get username() {
    return this.#username;
  }

  get email() {
    return this.#email;
  }

  get passwordHash() {
    return this.#passwordHash;
  }

  get avatar() {
    return this.#avatar;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get updatedAt() {
    return this.#updatedAt;
  }

  updateProfile({ username, email, passwordHash }, now = new Date()) {
    if (username) {
      this.#username = username;
    }
    if (email) {
      this.#email = email;
    }
    if (passwordHash) {
      this.#passwordHash = passwordHash;
    }
    this.#touch(now);
  }

  changeAvatar(avatar, now = new Date()) {
    this.#avatar = avatar;
    this.#touch(now);
  }

  toSnapshot() {
    return {
      id: this.#id,
      username: this.#username.value,
      email: this.#email.value,
      passwordHash: this.#passwordHash,
      avatar: this.#avatar,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  #touch(now) {
    this.#updatedAt = now.toISOString();
  }
}
