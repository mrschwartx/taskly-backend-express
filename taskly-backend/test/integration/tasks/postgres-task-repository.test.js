import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DueDate } from '../../../src/modules/tasks/domain/value-objects/due-date.js';
import { TaskName } from '../../../src/modules/tasks/domain/value-objects/task-name.js';
import { TaskStatus } from '../../../src/modules/tasks/domain/value-objects/task-status.js';
import { PostgresTaskRepository } from '../../../src/modules/tasks/infrastructure/postgres-task-repository.js';
import { generateEntityId } from '../../../src/shared/domain/entity-id.js';
import { runMigrations } from '../../../src/shared/infrastructure/postgres/migrator.js';
import { PostgresConnection } from '../../../src/shared/infrastructure/postgres/postgres-connection.js';
import { buildTask } from '../../support/builders.js';
import { startTestDatabase } from '../../support/postgres.js';

describe('PostgresTaskRepository', () => {
  let database;
  let connection;
  let pool;
  let repository;

  const ownerA = generateEntityId();
  const ownerB = generateEntityId();

  let clock = 0;

  const newTask = (overrides = {}) =>
    buildTask({
      id: repository.nextId(),
      ownerId: ownerA,
      now: new Date(Date.UTC(2026, 0, 1, 0, 0, (clock += 1))),
      ...overrides,
    });

  before(async () => {
    database = await startTestDatabase();
    connection = new PostgresConnection({
      url: database.url,
      poolMax: 4,
      timeoutMs: 5000,
    });
    pool = await connection.connect();
    await runMigrations(pool);
    repository = new PostgresTaskRepository({ pool });
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE users CASCADE');
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash)
       VALUES ($1, 'owner_a', 'owner_a@mail.com', 'hash'),
              ($2, 'owner_b', 'owner_b@mail.com', 'hash')`,
      [ownerA, ownerB]
    );
  });

  after(async () => {
    await connection.close();
    await database.stop();
  });

  it('generates unique valid UUIDs', () => {
    assert.match(
      repository.nextId(),
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
    );
    assert.notEqual(repository.nextId(), repository.nextId());
  });

  it('persists tasks in typed columns', async () => {
    const task = newTask();
    await repository.add(task);

    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [
      task.id,
    ]);

    assert.equal(rows[0].owner_id, ownerA);
    assert.equal(rows[0].name, 'Read Atomic Habits');
    assert.equal(rows[0].status, 'todo');
    assert.ok(rows[0].due instanceof Date);
    assert.ok(rows[0].created_at instanceof Date);
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

  it('returns tasks in creation order by default', async () => {
    const created = [];
    for (let index = 0; index < 4; index += 1) {
      const task = newTask();
      created.push(task.id);
      await repository.add(task);
    }

    const result = await repository.findByOwner({
      ownerId: ownerA,
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      result.tasks.map((task) => task.id),
      created
    );
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
    const beyond = await repository.findByOwner({
      ownerId: ownerA,
      page: 4,
      pageSize: 2,
    });

    const ids = [...first.tasks, ...second.tasks, ...third.tasks].map(
      (task) => task.id
    );
    assert.equal(first.total, 5);
    assert.equal(third.tasks.length, 1);
    assert.equal(new Set(ids).size, 5);
    assert.equal(beyond.tasks.length, 0);
    assert.equal(beyond.total, 5);
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

  it('sorts by due date chronologically', async () => {
    await repository.add(newTask({ due: DueDate.create('2026-03-01') }));
    await repository.add(newTask({ due: DueDate.create('2026-01-01') }));
    await repository.add(
      newTask({ due: DueDate.create('2026-02-01T00:00:00+07:00') })
    );

    const result = await repository.findByOwner({
      ownerId: ownerA,
      orderBy: 'due',
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      result.tasks.map((task) => task.due.value),
      [
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T17:00:00.000Z',
        '2026-03-01T00:00:00.000Z',
      ]
    );
  });

  it('sorts by camelCase fields mapped to columns', async () => {
    const first = newTask();
    await repository.add(first);
    const second = newTask();
    await repository.add(second);

    const result = await repository.findByOwner({
      ownerId: ownerA,
      orderBy: 'createdAt',
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      result.tasks.map((task) => task.id),
      [first.id, second.id]
    );
  });

  it('ignores unknown sort fields instead of building unsafe SQL', async () => {
    await repository.add(newTask());

    const result = await repository.findByOwner({
      ownerId: ownerA,
      orderBy: 'name; DROP TABLE tasks',
      page: 1,
      pageSize: 10,
    });

    assert.equal(result.total, 1);
    assert.equal((await pool.query('SELECT 1 FROM tasks')).rowCount, 1);
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
