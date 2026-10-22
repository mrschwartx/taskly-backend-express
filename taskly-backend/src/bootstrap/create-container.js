import { createTasksModule } from '../modules/tasks/index.js';
import { createUsersModule } from '../modules/users/index.js';
import { InMemoryEventBus } from '../shared/infrastructure/events/in-memory-event-bus.js';
import { runMigrations } from '../shared/infrastructure/postgres/migrator.js';
import { PostgresConnection } from '../shared/infrastructure/postgres/postgres-connection.js';

export const createContainer = async ({ config, logger }) => {
  const database = new PostgresConnection({ ...config.database, logger });

  try {
    const pool = await database.connect();
    await runMigrations(pool, { logger });

    const eventBus = new InMemoryEventBus({ logger });
    const users = createUsersModule({ pool, config, logger, eventBus });
    const tasks = createTasksModule({
      pool,
      eventBus,
      authenticate: users.authenticate,
    });

    return {
      config,
      logger,
      eventBus,
      modules: { users, tasks },
      close: () => database.close(),
    };
  } catch (error) {
    await database.close();
    throw error;
  }
};
