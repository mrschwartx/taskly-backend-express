import { Router } from 'express';
import { ensureOwnAccount } from './ensure-own-account.js';

export const createUsersRouter = ({
  controller,
  authenticate,
  uploadAvatar,
}) => {
  const router = Router();
  router.use(authenticate);
  router.get('/', controller.getUsers);
  router.get('/:id', controller.getUser);
  router.patch('/update/:id', controller.updateUser);
  router.post(
    '/upload/:id',
    ensureOwnAccount('You can only upload an avatar for your own account'),
    uploadAvatar,
    controller.uploadAvatar
  );
  router.delete('/delete/:id', controller.deleteUser);
  return router;
};
