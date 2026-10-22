import pg from 'pg';
import { randomDatabaseName } from './test-config.js';

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://dev_user:dev_pass@localhost:5432/taskly_dev';

const quoteIdentifier = (name) => `"${name.replaceAll('"', '""')}"`;

const withAdminClient = async (adminUrl, callback) => {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
};

export const startTestDatabase = async () => {
  const adminUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const name = randomDatabaseName();

  await withAdminClient(adminUrl, (client) =>
    client.query(`CREATE DATABASE ${quoteIdentifier(name)}`)
  );

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  return {
    name,
    url: url.toString(),
    stop: () =>
      withAdminClient(adminUrl, (client) =>
        client.query(
          `DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`
        )
      ),
  };
};
