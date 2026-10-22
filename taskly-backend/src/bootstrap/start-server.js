import { createApp } from './create-app.js';
import { createContainer } from './create-container.js';

const listen = (app, { port, host }) =>
  new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once('error', reject);
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });

export const startServer = async ({ config, logger }) => {
  const container = await createContainer({ config, logger });

  try {
    const app = createApp(container);
    const server = await listen(app, config.app);
    const { port } = server.address();

    logger.info(`Server is running on http://${config.app.host}:${port}`);

    return {
      app,
      server,
      port,
      container,
      stop: async () => {
        await closeServer(server);
        await container.close();
      },
    };
  } catch (error) {
    await container.close();
    throw error;
  }
};
