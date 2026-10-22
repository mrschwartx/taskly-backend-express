CREATE TABLE users (
  seq           BIGINT GENERATED ALWAYS AS IDENTITY,
  id            UUID PRIMARY KEY,
  username      VARCHAR(50) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE UNIQUE INDEX users_username_unique ON users (username);
CREATE INDEX users_seq ON users (seq);
