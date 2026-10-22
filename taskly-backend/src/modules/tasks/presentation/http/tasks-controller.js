export const createTasksController = ({
  createTask,
  getTask,
  listTasksByUser,
  updateTask,
  deleteTask,
}) => ({
  getTasksByUser: async (req, res) => {
    const result = await listTasksByUser.execute({
      requesterId: req.auth.userId,
      ownerId: req.params.id,
      status: req.query.status,
      orderBy: req.query.orderBy,
      page: req.query.page,
    });
    res.status(200).json(result);
  },

  getTask: async (req, res) => {
    const task = await getTask.execute({
      requesterId: req.auth.userId,
      taskId: req.params.id,
    });
    res.status(200).json(task);
  },

  createTask: async (req, res) => {
    const task = await createTask.execute({
      ownerId: req.auth.userId,
      input: req.body,
    });
    res.status(200).json(task);
  },

  updateTask: async (req, res) => {
    const task = await updateTask.execute({
      requesterId: req.auth.userId,
      taskId: req.params.id,
      changes: req.body,
    });
    res.status(200).json(task);
  },

  deleteTask: async (req, res) => {
    await deleteTask.execute({
      requesterId: req.auth.userId,
      taskId: req.params.id,
    });
    res.status(200).json({ message: 'Task has been deleted' });
  },
});
