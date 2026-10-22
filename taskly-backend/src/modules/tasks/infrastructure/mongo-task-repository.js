import { ObjectId } from 'mongodb';
import { Task } from '../domain/task.js';
import { TaskRepository } from '../domain/task-repository.js';

const COLLECTION_NAME = 'tasks';

const toDocument = (task) => {
  const snapshot = task.toSnapshot();
  return {
    _id: new ObjectId(snapshot.id),
    name: snapshot.name,
    description: snapshot.description,
    priority: snapshot.priority,
    due: snapshot.due,
    status: snapshot.status,
    owner: new ObjectId(snapshot.ownerId),
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
};

const toEntity = (document) =>
  Task.restore({
    id: document._id.toHexString(),
    ownerId: document.owner.toHexString(),
    name: document.name,
    description: document.description ?? '',
    priority: document.priority,
    due: document.due,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });

export class MongoTaskRepository extends TaskRepository {
  #collection;

  constructor({ db }) {
    super();
    this.#collection = db.collection(COLLECTION_NAME);
  }

  async ensureIndexes() {
    await this.#collection.createIndexes([
      { key: { owner: 1, status: 1 }, name: 'tasks_owner_status' },
    ]);
  }

  nextId() {
    return new ObjectId().toHexString();
  }

  async add(task) {
    await this.#collection.insertOne(toDocument(task));
  }

  async update(task) {
    const { _id, ...fields } = toDocument(task);
    const result = await this.#collection.updateOne({ _id }, { $set: fields });
    return result.matchedCount === 1;
  }

  async findById(id) {
    const document = await this.#collection.findOne({ _id: new ObjectId(id) });
    return document ? toEntity(document) : null;
  }

  async findByOwner({ ownerId, status, orderBy, page, pageSize }) {
    const filter = { owner: new ObjectId(ownerId) };
    if (status) {
      filter.status = status;
    }
    const sort = orderBy ? { [orderBy]: 1, _id: 1 } : { _id: 1 };

    const [documents, total] = await Promise.all([
      this.#collection
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.#collection.countDocuments(filter),
    ]);

    return { tasks: documents.map(toEntity), total };
  }

  async deleteById(id) {
    const result = await this.#collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async deleteByOwner(ownerId) {
    const result = await this.#collection.deleteMany({
      owner: new ObjectId(ownerId),
    });
    return result.deletedCount;
  }
}
