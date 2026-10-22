import { Router } from 'express';

export const createAuthRouter = ({ controller }) => {
  const router = Router();
  router.post('/signup', controller.signUp);
  router.post('/signin', controller.signIn);
  router.get('/signout', controller.signOut);
  return router;
};
