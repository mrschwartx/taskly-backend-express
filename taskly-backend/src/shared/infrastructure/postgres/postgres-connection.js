import pg from 'pg';

export class PostgresConnection {
  #pool;
  #closed = false;

  constructor({ url, poolMax, timeoutMs, logger }) {
    this.#pool = new pg.Pool({
      connectionString: url,
      max: poolMax,
      connectionTimeoutMillis: timeoutMs,
    });
    this.#pool.on('error', (error) => {
      logger?.error('Idle PostgreSQL client error', {
        message: error.message,
      });
    });
  }

  async connect() {
    await this.#pool.query('SELECT 1');
    return this.#pool;
  }

  get pool() {
    return this.#pool;
  }

  async close() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#pool.end();
  }
}
