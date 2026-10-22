import { generateEntityId } from '../../../shared/domain/entity-id.js';
import { AlreadyExistsError } from '../../../shared/domain/errors.js';
import { isUniqueViolationError } from '../../../shared/infrastructure/postgres/is-unique-violation-error.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user-repository.js';

const DUPLICATE_MESSAGE = 'Email or Username is already registered.';

const COLUMNS =
  'id, username, email, password_hash, avatar, created_at, updated_at';

const escapeLikePattern = (value) => value.replace(/[\\%_]/g, '\\$&');

const toEntity = (row) =>
  User.restore({
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    avatar: row.avatar,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });

export class PostgresUserRepository extends UserRepository {
  #pool;

  constructor({ pool }) {
    super();
    this.#pool = pool;
  }

  nextId() {
    return generateEntityId();
  }

  async add(user) {
    const snapshot = user.toSnapshot();
    try {
      await this.#pool.query(
        `INSERT INTO users (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          snapshot.id,
          snapshot.username,
          snapshot.email,
          snapshot.passwordHash,
          snapshot.avatar,
          snapshot.createdAt,
          snapshot.updatedAt,
        ]
      );
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new AlreadyExistsError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(user) {
    const snapshot = user.toSnapshot();
    try {
      const result = await this.#pool.query(
        `UPDATE users
            SET username = $2,
                email = $3,
                password_hash = $4,
                avatar = $5,
                updated_at = $6
          WHERE id = $1`,
        [
          snapshot.id,
          snapshot.username,
          snapshot.email,
          snapshot.passwordHash,
          snapshot.avatar,
          snapshot.updatedAt,
        ]
      );
      return result.rowCount === 1;
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new AlreadyExistsError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async findById(id) {
    const { rows } = await this.#pool.query(
      `SELECT ${COLUMNS} FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByEmail(email) {
    const { rows } = await this.#pool.query(
      `SELECT ${COLUMNS} FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async existsByEmailOrUsername({ email, username, excludeId }) {
    const values = [];
    const conditions = [];
    if (email !== undefined) {
      values.push(email);
      conditions.push(`email = $${values.length}`);
    }
    if (username !== undefined) {
      values.push(username);
      conditions.push(`username = $${values.length}`);
    }
    if (conditions.length === 0) {
      return false;
    }

    let sql = `SELECT 1 FROM users WHERE (${conditions.join(' OR ')})`;
    if (excludeId) {
      values.push(excludeId);
      sql += ` AND id <> $${values.length}`;
    }

    const { rowCount } = await this.#pool.query(`${sql} LIMIT 1`, values);
    return rowCount > 0;
  }

  async search({ username, email } = {}) {
    const values = [];
    const conditions = [];
    if (username) {
      values.push(`%${escapeLikePattern(username)}%`);
      conditions.push(`username ILIKE $${values.length}`);
    }
    if (email) {
      values.push(`%${escapeLikePattern(email)}%`);
      conditions.push(`email ILIKE $${values.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.#pool.query(
      `SELECT ${COLUMNS} FROM users ${where} ORDER BY seq ASC`,
      values
    );
    return rows.map(toEntity);
  }

  async deleteById(id) {
    const result = await this.#pool.query('DELETE FROM users WHERE id = $1', [
      id,
    ]);
    return result.rowCount === 1;
  }
}
