import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AlreadyExistsError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../src/shared/domain/errors.js';
import { createErrorHandler } from '../../../src/shared/infrastructure/http/error-handler.js';
import { notFoundHandler } from '../../../src/shared/infrastructure/http/not-found-handler.js';
import { createSpyLogger } from '../../support/silent-logger.js';

const createResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(payload) {
      response.body = payload;
      return response;
    },
  };
  return response;
};

describe('error handler', () => {
  const handle = (error) => {
    const logger = createSpyLogger();
    const response = createResponse();
    createErrorHandler({ logger })(error, {}, response, () => {});
    return { response, logger };
  };

  const mappings = [
    [new ValidationError('bad'), 400],
    [new AuthenticationError('who are you'), 401],
    [new ForbiddenError('nope'), 403],
    [new NotFoundError('missing'), 404],
    [new AlreadyExistsError('taken'), 422],
  ];

  for (const [error, status] of mappings) {
    it(`maps ${error.name} to ${status}`, () => {
      const { response } = handle(error);
      assert.equal(response.statusCode, status);
      assert.deepEqual(response.body, { status, message: error.message });
    });
  }

  it('maps malformed JSON bodies to 400', () => {
    const { response } = handle(
      Object.assign(new Error('Unexpected token'), {
        type: 'entity.parse.failed',
      })
    );
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, 'Malformed JSON body');
  });

  it('maps oversized bodies to 413', () => {
    const { response } = handle(
      Object.assign(new Error('too large'), { type: 'entity.too.large' })
    );
    assert.equal(response.statusCode, 413);
  });

  it('hides internals of unexpected errors and logs them', () => {
    const { response, logger } = handle(new Error('db password is hunter2'));
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      status: 500,
      message: "We're having technical issues. Please try again later.",
    });
    assert.equal(logger.entries.at(-1).level, 'error');
  });

  it('responds to unknown routes with 404', () => {
    const response = createResponse();
    notFoundHandler({}, response);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { message: 'Not found' });
  });
});
