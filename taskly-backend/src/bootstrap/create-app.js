import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { createErrorHandler } from '../shared/infrastructure/http/error-handler.js';
import { notFoundHandler } from '../shared/infrastructure/http/not-found-handler.js';
import { createRequestLogger } from '../shared/infrastructure/http/request-logger.js';

export const createApp = ({ config, logger, modules }) => {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(createRequestLogger({ logger }));
  app.use(
    express.static(config.storage.publicDir, {
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );

  app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the Taskly API' });
  });

  app.use('/api/v1/auth', modules.users.authRouter);
  app.use('/api/v1/users', modules.users.usersRouter);
  app.use('/api/v1/tasks', modules.tasks.router);

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger }));

  return app;
};
