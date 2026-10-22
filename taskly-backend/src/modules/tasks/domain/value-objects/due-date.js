import { ValidationError } from '../../../../shared/domain/errors.js';

export class DueDate {
  #value;

  constructor(value) {
    this.#value = value;
    Object.freeze(this);
  }

  static create(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new ValidationError('Task due date is required');
    }
    const value = raw.trim();
    if (Number.isNaN(Date.parse(value))) {
      throw new ValidationError('Task due date is invalid');
    }
    return new DueDate(value);
  }

  static restore(value) {
    return new DueDate(value);
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof DueDate && other.value === this.#value;
  }
}
