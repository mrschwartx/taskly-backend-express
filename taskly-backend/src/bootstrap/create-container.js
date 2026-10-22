import { createTasksModule } from '../modules/tasks/index.js';
import { createUsersModule } from '../modules/users/index.js';
import { InMemoryEventBus } from '../shared/infrastructure/events/in-memory-event-bus.js';
import { MongoConnection } from '../shared/infrastructure/mongo/mongo-connection.js';

export const createContainer = async ({ config, logger }) => {
  const mongo = new MongoConnection(config.mongo);
  const db = await mongo.connect();

  try {
    const eventBus = new InMemoryEventBus({ logger });
    const users = createUsersModule({ db, config, logger, eventBus });
    const tasks = createTasksModule({
      db,
      eventBus,
      authenticate: users.authenticate,
    });

    await Promise.all([users.initialize(), tasks.initialize()]);

    return {
      config,
      logger,
      eventBus,
      modules: { users, tasks },
      close: () => mongo.close(),
    };
  } catch (error) {
    await mongo.close();
    throw error;
  }
};
