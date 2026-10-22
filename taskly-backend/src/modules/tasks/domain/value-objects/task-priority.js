import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const TaskPriority = defineTextValueObject({
  label: 'Task priority',
  minLength: 1,
  maxLength: 50,
});
