import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);
export const DEFAULT_TASK_STATUS = 'todo';

export const TaskStatus = defineTextValueObject({
  label: 'Task status',
  minLength: 1,
  maxLength: 50,
  defaultValue: DEFAULT_TASK_STATUS,
  allowedValues: TASK_STATUSES,
});
