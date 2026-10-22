import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const DEFAULT_TASK_STATUS = 'open';

export const TaskStatus = defineTextValueObject({
  label: 'Task status',
  minLength: 1,
  maxLength: 50,
  defaultValue: DEFAULT_TASK_STATUS,
});
