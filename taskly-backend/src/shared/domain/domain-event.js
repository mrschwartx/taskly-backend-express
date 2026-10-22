export const createDomainEvent = (name, payload, occurredAt = new Date()) =>
  Object.freeze({
    name,
    payload: Object.freeze({ ...payload }),
    occurredAt: occurredAt.toISOString(),
  });
