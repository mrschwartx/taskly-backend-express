import 'dotenv/config';
import { loadConfig } from '../config/env.js';
import { createLogger } from '../shared/infrastructure/logging/logger.js';
import { runMigrations } from '../shared/infrastructure/postgres/migrator.js';
import { PostgresConnection } from '../shared/infrastructure/postgres/postgres-connection.js';

const migrate = async () => {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = new PostgresConnection({ ...config.database, logger });

  try {
    const pool = await database.connect();
    const executed = await runMigrations(pool, { logger });
    logger.info(`Migrations completed, ${executed.length} applied`);
  } finally {
    await database.close();
  }
};

try {
  await migrate();
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
}
