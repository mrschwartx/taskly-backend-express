import { MongoClient } from 'mongodb';

export class MongoConnection {
  #client;
  #dbName;
  #db = null;

  constructor({ uri, db, timeoutMs }) {
    this.#client = new MongoClient(uri, {
      serverSelectionTimeoutMS: timeoutMs,
    });
    this.#dbName = db;
  }

  async connect() {
    await this.#client.connect();
    this.#db = this.#client.db(this.#dbName);
    return this.#db;
  }

  get db() {
    if (!this.#db) {
      throw new Error('MongoDB is not connected');
    }
    return this.#db;
  }

  async close() {
    if (this.#db) {
      await this.#client.close();
      this.#db = null;
    }
  }
}
