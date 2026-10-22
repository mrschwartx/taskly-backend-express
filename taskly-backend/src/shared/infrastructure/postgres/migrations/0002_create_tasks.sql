CREATE TABLE tasks (
  seq         BIGINT GENERATED ALWAYS AS IDENTITY,
  id          UUID PRIMARY KEY,
  owner_id    UUID NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  priority    VARCHAR(50) NOT NULL,
  due         TIMESTAMPTZ NOT NULL,
  status      VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX tasks_owner_status ON tasks (owner_id, status, seq);
