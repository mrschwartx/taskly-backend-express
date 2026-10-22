import { Router } from 'express';

export const createTasksRouter = ({ controller, authenticate }) => {
  const router = Router();
  router.use(authenticate);
  router.get('/user/:id', controller.getTasksByUser);
  router.get('/:id', controller.getTask);
  router.post('/create', controller.createTask);
  router.patch('/:id', controller.updateTask);
  router.delete('/:id', controller.deleteTask);
  return router;
};
