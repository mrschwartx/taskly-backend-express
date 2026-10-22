import { USER_DELETED } from '../../shared/domain/integration-events.js';
import { CreateTask } from './application/use-cases/create-task.js';
import { DeleteTask } from './application/use-cases/delete-task.js';
import { DeleteTasksByOwner } from './application/use-cases/delete-tasks-by-owner.js';
import { GetTask } from './application/use-cases/get-task.js';
import { ListTasksByUser } from './application/use-cases/list-tasks-by-user.js';
import { UpdateTask } from './application/use-cases/update-task.js';
import { MongoTaskRepository } from './infrastructure/mongo-task-repository.js';
import { createTasksController } from './presentation/http/tasks-controller.js';
import { createTasksRouter } from './presentation/http/tasks-router.js';

export const createTasksModule = ({ db, eventBus, authenticate }) => {
  const taskRepository = new MongoTaskRepository({ db });

  const useCases = {
    createTask: new CreateTask({ taskRepository }),
    getTask: new GetTask({ taskRepository }),
    listTasksByUser: new ListTasksByUser({ taskRepository }),
    updateTask: new UpdateTask({ taskRepository }),
    deleteTask: new DeleteTask({ taskRepository }),
    deleteTasksByOwner: new DeleteTasksByOwner({ taskRepository }),
  };

  eventBus.subscribe(USER_DELETED, ({ payload }) =>
    useCases.deleteTasksByOwner.execute({ ownerId: payload.userId })
  );

  const router = createTasksRouter({
    controller: createTasksController(useCases),
    authenticate,
  });

  return {
    router,
    useCases,
    initialize: () => taskRepository.ensureIndexes(),
  };
};
