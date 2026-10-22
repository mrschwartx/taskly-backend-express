import { ValidationError } from '../../../../shared/domain/errors.js';

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

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
    const timestamp = Date.parse(raw.trim());
    if (Number.isNaN(timestamp)) {
      throw new ValidationError('Task due date is invalid');
    }
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) {
      throw new ValidationError('Task due date is invalid');
    }
    return new DueDate(date.toISOString());
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
