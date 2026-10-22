import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import { MongoTaskRepository } from '../../../src/modules/tasks/infrastructure/mongo-task-repository.js';
import { MongoConnection } from '../../../src/shared/infrastructure/mongo/mongo-connection.js';
import { buildTask } from '../../support/builders.js';
import { startTestMongo } from '../../support/mongo.js';
import { randomDatabaseName } from '../../support/test-config.js';
import { DueDate } from '../../../src/modules/tasks/domain/value-objects/due-date.js';
import { TaskName } from '../../../src/modules/tasks/domain/value-objects/task-name.js';
import { TaskStatus } from '../../../src/modules/tasks/domain/value-objects/task-status.js';

describe('MongoTaskRepository', () => {
  let mongo;
  let connection;
  let db;
  let repository;

  const ownerA = new ObjectId().toHexString();
  const ownerB = new ObjectId().toHexString();

  const newTask = (overrides = {}) =>
    buildTask({ id: repository.nextId(), ownerId: ownerA, ...overrides });

  before(async () => {
    mongo = await startTestMongo();
    connection = new MongoConnection({
      uri: mongo.uri,
      db: randomDatabaseName(),
      timeoutMs: 5000,
    });
    db = await connection.connect();
    repository = new MongoTaskRepository({ db });
    await repository.ensureIndexes();
  });

  beforeEach(async () => {
    await db.collection('tasks').deleteMany({});
  });

  after(async () => {
    await db.dropDatabase();
    await connection.close();
    await mongo.stop();
  });

  it('persists tasks with the legacy document shape', async () => {
    const task = newTask();
    await repository.add(task);

    const document = await db
      .collection('tasks')
      .findOne({ _id: new ObjectId(task.id) });

    assert.ok(document.owner instanceof ObjectId);
    assert.equal(document.owner.toHexString(), ownerA);
    assert.equal(document.name, 'Read Atomic Habits');
    assert.equal(document.status, 'open');
    assert.equal(typeof document.createdAt, 'string');
  });

  it('finds tasks by id', async () => {
    const task = newTask();
    await repository.add(task);

    const found = await repository.findById(task.id);

    assert.deepEqual(found.toSnapshot(), task.toSnapshot());
    assert.equal(await repository.findById(repository.nextId()), null);
  });

  it('updates tasks and reports whether they exist', async () => {
    const task = newTask();
    await repository.add(task);

    task.update({ name: TaskName.create('Renamed') });
    assert.equal(await repository.update(task), true);
    assert.equal((await repository.findById(task.id)).name.value, 'Renamed');

    assert.equal(await repository.update(newTask()), false);
  });

  it('lists only the tasks of the given owner with a total', async () => {
    await repository.add(newTask());
    await repository.add(newTask());
    await repository.add(newTask({ ownerId: ownerB }));

    const result = await repository.findByOwner({
      ownerId: ownerA,
      page: 1,
      pageSize: 10,
    });

    assert.equal(result.total, 2);
    assert.equal(result.tasks.length, 2);
    assert.ok(result.tasks.every((task) => task.ownerId === ownerA));
  });

  it('paginates with stable ordering', async () => {
    for (let index = 0; index < 5; index += 1) {
      await repository.add(newTask());
    }

    const first = await repository.findByOwner({
      ownerId: ownerA,
      page: 1,
      pageSize: 2,
    });
    const second = await repository.findByOwner({
      ownerId: ownerA,
      page: 2,
      pageSize: 2,
    });
    const third = await repository.findByOwner({
      ownerId: ownerA,
      page: 3,
      pageSize: 2,
    });

    const ids = [...first.tasks, ...second.tasks, ...third.tasks].map(
      (task) => task.id
    );
    assert.equal(first.total, 5);
    assert.equal(third.tasks.length, 1);
    assert.equal(new Set(ids).size, 5);
  });

  it('filters by status', async () => {
    await repository.add(newTask());
    await repository.add(newTask({ status: TaskStatus.create('done') }));

    const result = await repository.findByOwner({
      ownerId: ownerA,
      status: 'done',
      page: 1,
      pageSize: 10,
    });

    assert.equal(result.total, 1);
    assert.equal(result.tasks[0].status.value, 'done');
  });

  it('sorts ascending by the requested field', async () => {
    await repository.add(newTask({ name: TaskName.create('charlie') }));
    await repository.add(newTask({ name: TaskName.create('alpha') }));
    await repository.add(newTask({ name: TaskName.create('bravo') }));

    const result = await repository.findByOwner({
      ownerId: ownerA,
      orderBy: 'name',
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      result.tasks.map((task) => task.name.value),
      ['alpha', 'bravo', 'charlie']
    );
  });

  it('sorts by due date', async () => {
    await repository.add(newTask({ due: DueDate.create('2026-03-01') }));
    await repository.add(newTask({ due: DueDate.create('2026-01-01') }));

    const result = await repository.findByOwner({
      ownerId: ownerA,
      orderBy: 'due',
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      result.tasks.map((task) => task.due.value),
      ['2026-01-01', '2026-03-01']
    );
  });

  it('deletes single tasks', async () => {
    const task = newTask();
    await repository.add(task);

    assert.equal(await repository.deleteById(task.id), true);
    assert.equal(await repository.deleteById(task.id), false);
  });

  it('deletes all tasks of an owner only', async () => {
    await repository.add(newTask());
    await repository.add(newTask());
    await repository.add(newTask({ ownerId: ownerB }));

    assert.equal(await repository.deleteByOwner(ownerA), 2);

    const remaining = await repository.findByOwner({
      ownerId: ownerB,
      page: 1,
      pageSize: 10,
    });
    assert.equal(remaining.total, 1);
  });
});
