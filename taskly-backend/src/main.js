import 'dotenv/config';
import { startServer } from './bootstrap/start-server.js';
import { loadConfig } from './config/env.js';
import { createLogger } from './shared/infrastructure/logging/logger.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'];

const bootstrap = async () => {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const logger = createLogger(config);

  let instance;
  try {
    instance = await startServer({ config, logger });
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);
    try {
      await instance.stop();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { message: error.message });
      process.exit(1);
    }
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => shutdown(signal));
  }
};

await bootstrap();
