import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Task } from '../../../../src/modules/tasks/domain/task.js';
import { DueDate } from '../../../../src/modules/tasks/domain/value-objects/due-date.js';
import { TaskDescription } from '../../../../src/modules/tasks/domain/value-objects/task-description.js';
import { TaskName } from '../../../../src/modules/tasks/domain/value-objects/task-name.js';
import { TaskPriority } from '../../../../src/modules/tasks/domain/value-objects/task-priority.js';
import { TaskStatus } from '../../../../src/modules/tasks/domain/value-objects/task-status.js';
import { ValidationError } from '../../../../src/shared/domain/errors.js';
import {
  buildTask,
  OTHER_USER_ID,
  TASK_ID,
  USER_ID,
} from '../../../support/builders.js';

describe('Task', () => {
  it('is created with equal timestamps', () => {
    const task = buildTask();

    assert.equal(task.id, TASK_ID);
    assert.equal(task.ownerId, USER_ID);
    assert.equal(task.name.value, 'Read Atomic Habits');
    assert.equal(task.status.value, 'todo');
    assert.equal(task.createdAt, '2026-01-01T00:00:00.000Z');
    assert.equal(task.updatedAt, task.createdAt);
  });

  it('knows its owner', () => {
    const task = buildTask();
    assert.equal(task.isOwnedBy(USER_ID), true);
    assert.equal(task.isOwnedBy(OTHER_USER_ID), false);
  });

  it('applies partial updates and touches updatedAt', () => {
    const task = buildTask();

    task.update(
      {
        name: TaskName.create('Renamed'),
        status: TaskStatus.create('in_progress'),
      },
      new Date('2026-02-02T00:00:00.000Z')
    );

    assert.equal(task.name.value, 'Renamed');
    assert.equal(task.status.value, 'in_progress');
    assert.equal(task.priority.value, 'low');
    assert.equal(task.updatedAt, '2026-02-02T00:00:00.000Z');
    assert.equal(task.createdAt, '2026-01-01T00:00:00.000Z');
  });

  it('can never change its owner', () => {
    const task = buildTask();
    task.update({ ownerId: OTHER_USER_ID });
    assert.equal(task.ownerId, USER_ID);
  });

  it('round trips through snapshots', () => {
    const task = buildTask();
    assert.deepEqual(
      Task.restore(task.toSnapshot()).toSnapshot(),
      task.toSnapshot()
    );
  });
});

describe('task value objects', () => {
  it('TaskName trims and enforces bounds', () => {
    assert.equal(TaskName.create('  Write tests ').value, 'Write tests');
    assert.throws(() => TaskName.create('   '), ValidationError);
    assert.throws(() => TaskName.create('a'.repeat(121)), ValidationError);
    assert.throws(() => TaskName.create(undefined), ValidationError);
    assert.throws(() => TaskName.create({ $gt: '' }), ValidationError);
  });

  it('TaskDescription defaults to an empty string', () => {
    assert.equal(TaskDescription.create(undefined).value, '');
    assert.equal(TaskDescription.create('details').value, 'details');
    assert.throws(
      () => TaskDescription.create('a'.repeat(2001)),
      ValidationError
    );
    assert.throws(() => TaskDescription.create(42), ValidationError);
  });

  it('TaskPriority is required and limited to known values', () => {
    assert.equal(TaskPriority.create('high').value, 'high');
    assert.throws(() => TaskPriority.create(undefined), ValidationError);
    assert.throws(() => TaskPriority.create(''), ValidationError);
    assert.throws(() => TaskPriority.create('urgent'), ValidationError);
    assert.throws(() => TaskPriority.create('HIGH'), ValidationError);
  });

  it('TaskStatus defaults to todo', () => {
    assert.equal(TaskStatus.create(undefined).value, 'todo');
    assert.equal(TaskStatus.create('in_progress').value, 'in_progress');
    assert.throws(() => TaskStatus.create(''), ValidationError);
    assert.throws(() => TaskStatus.create('open'), ValidationError);
    assert.throws(() => TaskStatus.create('in-progress'), ValidationError);
  });

  it('DueDate accepts parseable dates only', () => {
    assert.equal(
      DueDate.create('2026-12-08T10:00:00Z').value,
      '2026-12-08T10:00:00.000Z'
    );
    assert.equal(
      DueDate.create('2026-12-08').value,
      '2026-12-08T00:00:00.000Z'
    );
    assert.throws(() => DueDate.create('not a date'), /invalid/);
    assert.throws(() => DueDate.create(undefined), /required/);
    assert.throws(() => DueDate.create(''), /required/);
  });

  it('compares by value within the same type', () => {
    assert.ok(TaskName.create('a').equals(TaskName.create('a')));
    assert.ok(!TaskName.create('a').equals(TaskName.create('b')));
    assert.ok(!TaskName.create('low').equals(TaskPriority.create('low')));
    assert.ok(
      DueDate.create('2026-01-01').equals(DueDate.create('2026-01-01'))
    );
  });
});
