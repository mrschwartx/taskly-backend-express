import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const TaskName = defineTextValueObject({
  label: 'Task name',
  minLength: 1,
  maxLength: 120,
});
