import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

export const TaskPriority = defineTextValueObject({
  label: 'Task priority',
  minLength: 1,
  maxLength: 50,
  allowedValues: TASK_PRIORITIES,
});
