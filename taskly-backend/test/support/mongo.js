export const startTestMongo = async () => {
  if (process.env.TEST_MONGO_URI) {
    return { uri: process.env.TEST_MONGO_URI, stop: async () => {} };
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  return { uri: server.getUri(), stop: () => server.stop() };
};
