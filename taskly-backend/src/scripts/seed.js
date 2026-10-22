import 'dotenv/config';
import { createContainer } from '../bootstrap/create-container.js';
import { loadConfig } from '../config/env.js';
import { AlreadyExistsError } from '../shared/domain/errors.js';
import { createLogger } from '../shared/infrastructure/logging/logger.js';

const now = () => new Date().toISOString();

const seeds = [
  {
    user: {
      username: 'johndoe123',
      email: 'johndoe123@mail.com',
      password: 'password123',
    },
    tasks: [
      {
        name: 'Read Atomic Habits',
        description: 'Finish reading Atomic Habits by James Clear',
        priority: 'not urgent',
        due: now(),
        status: 'open',
      },
    ],
  },
  {
    user: {
      username: 'jane78',
      email: 'jane@mail.com',
      password: 'securepassword456',
    },
    tasks: [
      {
        name: 'Learn MERN Stack',
        description:
          'Learn the MERN stack and build a full-stack application with it',
        priority: 'urgent',
        due: now(),
        status: 'open',
      },
    ],
  },
];

const seed = async () => {
  const config = loadConfig();
  const logger = createLogger(config);

  if (config.app.isProduction && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    logger.error('Refusing to seed a production database');
    process.exitCode = 1;
    return;
  }

  const container = await createContainer({ config, logger });
  const { users, tasks } = container.modules;

  try {
    for (const entry of seeds) {
      try {
        const { user } = await users.useCases.registerUser.execute(entry.user);
        for (const task of entry.tasks) {
          await tasks.useCases.createTask.execute({
            ownerId: user._id,
            input: task,
          });
        }
        logger.info(`Seeded user ${entry.user.username}`);
      } catch (error) {
        if (!(error instanceof AlreadyExistsError)) {
          throw error;
        }
        logger.warn(`Skipped existing user ${entry.user.username}`);
      }
    }
    logger.info('Seeding completed');
  } finally {
    await container.close();
  }
};

try {
  await seed();
} catch (error) {
  console.error(`Seeding failed: ${error.message}`);
  process.exitCode = 1;
}
