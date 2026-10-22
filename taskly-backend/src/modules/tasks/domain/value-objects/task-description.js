import { defineTextValueObject } from '../../../../shared/domain/text-value-object.js';

export const TaskDescription = defineTextValueObject({
  label: 'Task description',
  minLength: 0,
  maxLength: 2000,
  defaultValue: '',
});
