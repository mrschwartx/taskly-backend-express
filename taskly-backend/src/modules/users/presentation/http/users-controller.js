import { toAvatarPath } from '../../domain/avatar.js';

export const createUsersController = ({
  getUser,
  listUsers,
  updateUser,
  deleteUser,
  changeUserAvatar,
  authCookie,
}) => ({
  getUsers: async (req, res) => {
    const users = await listUsers.execute({
      username: req.query.username,
      email: req.query.email,
    });
    res.status(200).json(users);
  },

  getUser: async (req, res) => {
    const user = await getUser.execute({ userId: req.params.id });
    res.status(200).json(user);
  },

  updateUser: async (req, res) => {
    const user = await updateUser.execute({
      requesterId: req.auth.userId,
      userId: req.params.id,
      changes: req.body,
    });
    res.status(200).json(user);
  },

  deleteUser: async (req, res) => {
    await deleteUser.execute({
      requesterId: req.auth.userId,
      userId: req.params.id,
    });
    authCookie.clear(res);
    res.status(200).json({ message: 'User has been deleted' });
  },

  uploadAvatar: async (req, res) => {
    const user = await changeUserAvatar.execute({
      requesterId: req.auth.userId,
      userId: req.params.id,
      avatarPath: req.file ? toAvatarPath(req.file.filename) : undefined,
    });
    res.status(200).json(user);
  },
});
