import { ObjectId } from 'mongodb';
import { AlreadyExistsError } from '../../../shared/domain/errors.js';
import { isDuplicateKeyError } from '../../../shared/infrastructure/mongo/is-duplicate-key-error.js';
import { DEFAULT_AVATAR_PATH } from '../domain/avatar.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user-repository.js';

const COLLECTION_NAME = 'users';
const DUPLICATE_MESSAGE = 'Email or Username is already registered.';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toDocument = (user) => {
  const snapshot = user.toSnapshot();
  return {
    _id: new ObjectId(snapshot.id),
    username: snapshot.username,
    email: snapshot.email,
    password: snapshot.passwordHash,
    avatar: snapshot.avatar,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
};

const toEntity = (document) =>
  User.restore({
    id: document._id.toHexString(),
    username: document.username,
    email: document.email,
    passwordHash: document.password,
    avatar: document.avatar ?? DEFAULT_AVATAR_PATH,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });

export class MongoUserRepository extends UserRepository {
  #collection;

  constructor({ db }) {
    super();
    this.#collection = db.collection(COLLECTION_NAME);
  }

  async ensureIndexes() {
    await this.#collection.createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      { key: { username: 1 }, name: 'users_username_unique', unique: true },
    ]);
  }

  nextId() {
    return new ObjectId().toHexString();
  }

  async add(user) {
    try {
      await this.#collection.insertOne(toDocument(user));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AlreadyExistsError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(user) {
    const { _id, ...fields } = toDocument(user);
    try {
      const result = await this.#collection.updateOne(
        { _id },
        { $set: fields }
      );
      return result.matchedCount === 1;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AlreadyExistsError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async findById(id) {
    const document = await this.#collection.findOne({ _id: new ObjectId(id) });
    return document ? toEntity(document) : null;
  }

  async findByEmail(email) {
    const document = await this.#collection.findOne({ email });
    return document ? toEntity(document) : null;
  }

  async existsByEmailOrUsername({ email, username, excludeId }) {
    const conditions = [];
    if (email !== undefined) {
      conditions.push({ email });
    }
    if (username !== undefined) {
      conditions.push({ username });
    }
    if (conditions.length === 0) {
      return false;
    }

    const filter = { $or: conditions };
    if (excludeId) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }

    const document = await this.#collection.findOne(filter, {
      projection: { _id: 1 },
    });
    return document !== null;
  }

  async search({ username, email } = {}) {
    const filter = {};
    if (username) {
      filter.username = { $regex: escapeRegExp(username), $options: 'i' };
    }
    if (email) {
      filter.email = { $regex: escapeRegExp(email), $options: 'i' };
    }

    const documents = await this.#collection
      .find(filter)
      .sort({ _id: 1 })
      .toArray();
    return documents.map(toEntity);
  }

  async deleteById(id) {
    const result = await this.#collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }
}
