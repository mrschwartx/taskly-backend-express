import { Task } from '../../domain/task.js';
import { DueDate } from '../../domain/value-objects/due-date.js';
import { TaskDescription } from '../../domain/value-objects/task-description.js';
import { TaskName } from '../../domain/value-objects/task-name.js';
import { TaskPriority } from '../../domain/value-objects/task-priority.js';
import { TaskStatus } from '../../domain/value-objects/task-status.js';
import { toTaskDto } from '../task-dto.js';

export class CreateTask {
  #taskRepository;

  constructor({ taskRepository }) {
    this.#taskRepository = taskRepository;
  }

  async execute({ ownerId, input }) {
    const source = input ?? {};
    const task = Task.create({
      id: this.#taskRepository.nextId(),
      ownerId,
      name: TaskName.create(source.name),
      description: TaskDescription.create(source.description),
      priority: TaskPriority.create(source.priority),
      due: DueDate.create(source.due),
      status: TaskStatus.create(source.status),
    });
    await this.#taskRepository.add(task);
    return toTaskDto(task);
  }
}
