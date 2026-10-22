import { EventBus } from '../../../src/shared/application/event-bus.js';

export class RecordingEventBus extends EventBus {
  events = [];

  async publish(event) {
    this.events.push(event);
  }

  subscribe() {}
}
