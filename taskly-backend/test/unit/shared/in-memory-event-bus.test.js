import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDomainEvent } from '../../../src/shared/domain/domain-event.js';
import { InMemoryEventBus } from '../../../src/shared/infrastructure/events/in-memory-event-bus.js';
import { createSpyLogger } from '../../support/silent-logger.js';

describe('InMemoryEventBus', () => {
  it('delivers events to subscribed handlers in order', async () => {
    const bus = new InMemoryEventBus({ logger: createSpyLogger() });
    const calls = [];
    bus.subscribe('thing.happened', async () => calls.push('first'));
    bus.subscribe('thing.happened', async () => calls.push('second'));

    await bus.publish(createDomainEvent('thing.happened', { id: 1 }));

    assert.deepEqual(calls, ['first', 'second']);
  });

  it('passes the event to handlers', async () => {
    const bus = new InMemoryEventBus({ logger: createSpyLogger() });
    let received;
    bus.subscribe('thing.happened', (event) => {
      received = event;
    });

    await bus.publish(createDomainEvent('thing.happened', { id: 42 }));

    assert.equal(received.name, 'thing.happened');
    assert.equal(received.payload.id, 42);
    assert.match(received.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('ignores events without subscribers', async () => {
    const bus = new InMemoryEventBus({ logger: createSpyLogger() });
    await assert.doesNotReject(() =>
      bus.publish(createDomainEvent('unknown.event', {}))
    );
  });

  it('isolates handler failures and keeps delivering', async () => {
    const logger = createSpyLogger();
    const bus = new InMemoryEventBus({ logger });
    const calls = [];
    bus.subscribe('thing.happened', async () => {
      throw new Error('handler exploded');
    });
    bus.subscribe('thing.happened', async () => calls.push('survivor'));

    await bus.publish(createDomainEvent('thing.happened', {}));

    assert.deepEqual(calls, ['survivor']);
    assert.equal(logger.entries.length, 1);
    assert.equal(logger.entries[0].level, 'error');
    assert.equal(logger.entries[0].meta.message, 'handler exploded');
  });

  it('creates immutable domain events', () => {
    const event = createDomainEvent('thing.happened', { id: 1 });
    assert.throws(() => {
      event.payload.id = 2;
    }, TypeError);
  });
});
