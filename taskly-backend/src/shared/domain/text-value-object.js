import { ValidationError } from './errors.js';

export const defineTextValueObject = ({
  label,
  minLength = 1,
  maxLength,
  defaultValue,
}) =>
  class TextValueObject {
    #value;

    constructor(value) {
      this.#value = value;
      Object.freeze(this);
    }

    static create(raw) {
      const candidate = raw === undefined ? defaultValue : raw;
      if (typeof candidate !== 'string') {
        throw new ValidationError(`${label} is required`);
      }
      const value = candidate.trim();
      if (value.length < minLength || value.length > maxLength) {
        throw new ValidationError(
          `${label} must be between ${minLength} and ${maxLength} characters`
        );
      }
      return new TextValueObject(value);
    }

    static restore(value) {
      return new TextValueObject(value);
    }

    get value() {
      return this.#value;
    }

    equals(other) {
      return other instanceof TextValueObject && other.value === this.#value;
    }
  };
