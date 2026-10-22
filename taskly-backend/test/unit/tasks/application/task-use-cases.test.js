import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { CreateTask } from '../../../../src/modules/tasks/application/use-cases/create-task.js';
import { DeleteTask } from '../../../../src/modules/tasks/application/use-cases/delete-task.js';
import { DeleteTasksByOwner } from '../../../../src/modules/tasks/application/use-cases/delete-tasks-by-owner.js';
import { GetTask } from '../../../../src/modules/tasks/application/use-cases/get-task.js';
import {
  ListTasksByUser,
  TASKS_PAGE_SIZE,
} from '../../../../src/modules/tasks/application/use-cases/list-tasks-by-user.js';
import { UpdateTask } from '../../../../src/modules/tasks/application/use-cases/update-task.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors.js';
import {
  buildTask,
  OTHER_USER_ID,
  TASK_ID,
  USER_ID,
} from '../../../support/builders.js';
import { InMemoryTaskRepository } from '../../../support/fakes/in-memory-task-repository.js';

const validInput = {
  name: 'Read Atomic Habits',
  description: 'Finish reading Atomic Habits by James Clear',
  priority: 'not urgent',
  due: '2026-12-08T10:00:00Z',
  status: 'open',
};

describe('task use cases', () => {
  let taskRepository;

  beforeEach(async () => {
    taskRepository = new InMemoryTaskRepository();
    await taskRepository.add(buildTask());
  });

  describe('CreateTask', () => {
    it('creates a task owned by the requester', async () => {
      const task = await new CreateTask({ taskRepository }).execute({
        ownerId: USER_ID,
        input: validInput,
      });

      assert.match(task._id, /^[0-9a-f]{24}$/);
      assert.equal(task.owner, USER_ID);
      assert.equal(task.name, 'Read Atomic Habits');
      assert.equal(task.status, 'open');
      assert.equal(taskRepository.snapshots.size, 2);
    });

    it('applies defaults for description and status', async () => {
      const { name, priority, due } = validInput;
      const task = await new CreateTask({ taskRepository }).execute({
        ownerId: USER_ID,
        input: { name, priority, due },
      });
      assert.equal(task.description, '');
      assert.equal(task.status, 'open');
    });

    it('ignores client supplied owner and ids', async () => {
      const task = await new CreateTask({ taskRepository }).execute({
        ownerId: USER_ID,
        input: { ...validInput, owner: OTHER_USER_ID, _id: TASK_ID },
      });
      assert.equal(task.owner, USER_ID);
      assert.notEqual(task._id, TASK_ID);
    });

    it('rejects invalid input', async () => {
      const createTask = new CreateTask({ taskRepository });
      for (const input of [
        undefined,
        {},
        { ...validInput, name: '' },
        { ...validInput, due: 'tomorrow' },
        { ...validInput, priority: undefined },
      ]) {
        await assert.rejects(
          () => createTask.execute({ ownerId: USER_ID, input }),
          ValidationError
        );
      }
      assert.equal(taskRepository.snapshots.size, 1);
    });
  });

  describe('GetTask', () => {
    it('returns the task to its owner', async () => {
      const task = await new GetTask({ taskRepository }).execute({
        requesterId: USER_ID,
        taskId: TASK_ID,
      });
      assert.equal(task._id, TASK_ID);
      assert.equal(task.owner, USER_ID);
    });

    it('rejects other users', async () => {
      await assert.rejects(
        () =>
          new GetTask({ taskRepository }).execute({
            requesterId: OTHER_USER_ID,
            taskId: TASK_ID,
          }),
        ForbiddenError
      );
    });

    it('fails for unknown or malformed ids', async () => {
      const getTask = new GetTask({ taskRepository });
      await assert.rejects(
        () =>
          getTask.execute({
            requesterId: USER_ID,
            taskId: 'eeeeeeeeeeeeeeeeeeeeeeee',
          }),
        (error) =>
          error instanceof NotFoundError && error.message === 'Task not found!'
      );
      await assert.rejects(
        () => getTask.execute({ requesterId: USER_ID, taskId: 'bad' }),
        ValidationError
      );
    });
  });

  describe('ListTasksByUser', () => {
    beforeEach(async () => {
      for (let index = 0; index < 6; index += 1) {
        await taskRepository.add(
          buildTask({
            id: `${String(index).padStart(2, '0')}`.repeat(12),
          })
        );
      }
      await taskRepository.add(
        buildTask({ id: 'ffffffffffffffffffffffff', ownerId: OTHER_USER_ID })
      );
    });

    const list = (params) =>
      new ListTasksByUser({ taskRepository }).execute({
        requesterId: USER_ID,
        ownerId: USER_ID,
        ...params,
      });

    it('paginates with a fixed page size and reports the total', async () => {
      const first = await list({ page: '1' });
      const second = await list({ page: '2' });

      assert.equal(first.tasks.length, TASKS_PAGE_SIZE);
      assert.equal(second.tasks.length, 3);
      assert.equal(first.taskCount, 7);
    });

    it('defaults to the first page for missing or invalid pages', async () => {
      const expected = (await list({ page: '1' })).tasks.map(
        (task) => task._id
      );
      for (const page of [undefined, 'abc', '0', '-3']) {
        const result = await list({ page });
        assert.deepEqual(
          result.tasks.map((task) => task._id),
          expected
        );
      }
    });

    it('filters by status', async () => {
      const result = await list({ status: 'done' });
      assert.deepEqual(result, { tasks: [], taskCount: 0 });
    });

    it('never includes tasks of other users', async () => {
      const result = await list({ page: '2' });
      assert.ok(result.tasks.every((task) => task.owner === USER_ID));
    });

    it('forbids listing another user', async () => {
      await assert.rejects(
        () => list({ ownerId: OTHER_USER_ID }),
        ForbiddenError
      );
    });

    it('rejects invalid filters', async () => {
      await assert.rejects(() => list({ ownerId: 'bad' }), ValidationError);
      await assert.rejects(() => list({ orderBy: 'owner' }), ValidationError);
      await assert.rejects(() => list({ orderBy: '$where' }), ValidationError);
      await assert.rejects(() => list({ status: ['a', 'b'] }), ValidationError);
    });

    it('accepts sortable fields', async () => {
      await assert.doesNotReject(() => list({ orderBy: 'due' }));
    });
  });

  describe('UpdateTask', () => {
    const update = (changes, overrides = {}) =>
      new UpdateTask({ taskRepository }).execute({
        requesterId: USER_ID,
        taskId: TASK_ID,
        changes,
        ...overrides,
      });

    it('updates the provided fields', async () => {
      const task = await update({
        name: 'Updated',
        priority: 'urgent',
        status: 'in-progress',
      });
      assert.equal(task.name, 'Updated');
      assert.equal(task.priority, 'urgent');
      assert.equal(task.status, 'in-progress');
      assert.equal(task.due, '2026-12-08T10:00:00Z');
      assert.equal(taskRepository.snapshots.get(TASK_ID).name, 'Updated');
    });

    it('never lets the owner or id change', async () => {
      const task = await update({
        name: 'Updated',
        owner: OTHER_USER_ID,
        ownerId: OTHER_USER_ID,
        _id: 'ffffffffffffffffffffffff',
      });
      assert.equal(task.owner, USER_ID);
      assert.equal(task._id, TASK_ID);
    });

    it('rejects other users', async () => {
      await assert.rejects(
        () => update({ name: 'Hijack' }, { requesterId: OTHER_USER_ID }),
        (error) =>
          error instanceof ForbiddenError &&
          error.message === 'You are not authorized to update this task'
      );
      assert.equal(
        taskRepository.snapshots.get(TASK_ID).name,
        'Read Atomic Habits'
      );
    });

    it('rejects empty or invalid changes', async () => {
      for (const changes of [{}, null, [], { owner: OTHER_USER_ID }]) {
        await assert.rejects(() => update(changes), ValidationError);
      }
      await assert.rejects(() => update({ due: 'never' }), ValidationError);
      await assert.rejects(() => update({ name: '' }), ValidationError);
    });

    it('fails when the task does not exist', async () => {
      await assert.rejects(
        () => update({ name: 'x' }, { taskId: 'eeeeeeeeeeeeeeeeeeeeeeee' }),
        NotFoundError
      );
    });
  });

  describe('DeleteTask', () => {
    it('deletes the task of the owner', async () => {
      await new DeleteTask({ taskRepository }).execute({
        requesterId: USER_ID,
        taskId: TASK_ID,
      });
      assert.equal(taskRepository.snapshots.has(TASK_ID), false);
    });

    it('rejects other users and keeps the task', async () => {
      await assert.rejects(
        () =>
          new DeleteTask({ taskRepository }).execute({
            requesterId: OTHER_USER_ID,
            taskId: TASK_ID,
          }),
        (error) =>
          error instanceof ForbiddenError &&
          error.message === 'You are not authorized to delete this task'
      );
      assert.equal(taskRepository.snapshots.has(TASK_ID), true);
    });

    it('fails when the task does not exist', async () => {
      await assert.rejects(
        () =>
          new DeleteTask({ taskRepository }).execute({
            requesterId: USER_ID,
            taskId: 'eeeeeeeeeeeeeeeeeeeeeeee',
          }),
        NotFoundError
      );
    });
  });

  describe('DeleteTasksByOwner', () => {
    it('removes every task of the owner and nothing else', async () => {
      await taskRepository.add(
        buildTask({ id: 'ffffffffffffffffffffffff', ownerId: OTHER_USER_ID })
      );

      const deleted = await new DeleteTasksByOwner({ taskRepository }).execute({
        ownerId: USER_ID,
      });

      assert.equal(deleted, 1);
      assert.deepEqual(
        [...taskRepository.snapshots.keys()],
        ['ffffffffffffffffffffffff']
      );
    });

    it('rejects malformed owner ids', async () => {
      await assert.rejects(
        () =>
          new DeleteTasksByOwner({ taskRepository }).execute({ ownerId: 'x' }),
        ValidationError
      );
    });
  });
});
