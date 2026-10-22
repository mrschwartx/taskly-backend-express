export const toTaskDto = (task) => ({
  _id: task.id,
  name: task.name.value,
  description: task.description.value,
  priority: task.priority.value,
  due: task.due.value,
  status: task.status.value,
  owner: task.ownerId,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});
