export class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends DomainError {
  constructor(message) {
    super(message, 'NOT_FOUND');
  }
}

export class AlreadyExistsError extends DomainError {
  constructor(message) {
    super(message, 'ALREADY_EXISTS');
  }
}

export class AuthenticationError extends DomainError {
  constructor(message) {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message) {
    super(message, 'FORBIDDEN');
  }
}
