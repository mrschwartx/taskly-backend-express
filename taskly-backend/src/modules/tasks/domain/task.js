import { DueDate } from './value-objects/due-date.js';
import { TaskDescription } from './value-objects/task-description.js';
import { TaskName } from './value-objects/task-name.js';
import { TaskPriority } from './value-objects/task-priority.js';
import { TaskStatus } from './value-objects/task-status.js';

export class Task {
  #id;
  #ownerId;
  #name;
  #description;
  #priority;
  #due;
  #status;
  #createdAt;
  #updatedAt;

  constructor({
    id,
    ownerId,
    name,
    description,
    priority,
    due,
    status,
    createdAt,
    updatedAt,
  }) {
    this.#id = id;
    this.#ownerId = ownerId;
    this.#name = name;
    this.#description = description;
    this.#priority = priority;
    this.#due = due;
    this.#status = status;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;
  }

  static create({
    id,
    ownerId,
    name,
    description,
    priority,
    due,
    status,
    now = new Date(),
  }) {
    const timestamp = now.toISOString();
    return new Task({
      id,
      ownerId,
      name,
      description,
      priority,
      due,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  static restore(snapshot) {
    return new Task({
      id: snapshot.id,
      ownerId: snapshot.ownerId,
      name: TaskName.restore(snapshot.name),
      description: TaskDescription.restore(snapshot.description),
      priority: TaskPriority.restore(snapshot.priority),
      due: DueDate.restore(snapshot.due),
      status: TaskStatus.restore(snapshot.status),
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  get id() {
    return this.#id;
  }

  get ownerId() {
    return this.#ownerId;
  }

  get name() {
    return this.#name;
  }

  get description() {
    return this.#description;
  }

  get priority() {
    return this.#priority;
  }

  get due() {
    return this.#due;
  }

  get status() {
    return this.#status;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get updatedAt() {
    return this.#updatedAt;
  }

  isOwnedBy(userId) {
    return this.#ownerId === userId;
  }

  update({ name, description, priority, due, status }, now = new Date()) {
    this.#name = name ?? this.#name;
    this.#description = description ?? this.#description;
    this.#priority = priority ?? this.#priority;
    this.#due = due ?? this.#due;
    this.#status = status ?? this.#status;
    this.#updatedAt = now.toISOString();
  }

  toSnapshot() {
    return {
      id: this.#id,
      ownerId: this.#ownerId,
      name: this.#name.value,
      description: this.#description.value,
      priority: this.#priority.value,
      due: this.#due.value,
      status: this.#status.value,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
