import { EventBus } from '../../application/event-bus.js';

export class InMemoryEventBus extends EventBus {
  #handlers = new Map();
  #logger;

  constructor({ logger }) {
    super();
    this.#logger = logger;
  }

  subscribe(eventName, handler) {
    const handlers = this.#handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.#handlers.set(eventName, handlers);
  }

  async publish(event) {
    const handlers = this.#handlers.get(event.name) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.#logger.error('Event handler failed', {
          event: event.name,
          message: error.message,
          stack: error.stack,
        });
      }
    }
  }
}
