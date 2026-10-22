import { ValidationError } from '../../../../shared/domain/errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254;

export class Email {
  #value;

  constructor(value) {
    this.#value = value;
    Object.freeze(this);
  }

  static create(raw) {
    if (typeof raw !== 'string') {
      throw new ValidationError('Email is required');
    }
    const value = raw.trim();
    if (!value || value.length > MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      throw new ValidationError('Email is invalid');
    }
    return new Email(value);
  }

  static restore(value) {
    return new Email(value);
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof Email && other.value === this.#value;
  }
}
