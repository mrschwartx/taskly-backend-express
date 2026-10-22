import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpClient } from './http-client.js';
import { buildTestEnv, createTempPublicDir, removeDir } from './test-config.js';

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

export const findFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const collect = (stream) => {
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  return () => Buffer.concat(chunks).toString('utf8');
};

const waitForExit = (child) =>
  new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

export const runNodeScript = async (
  script,
  env,
  { timeoutMs = 30000 } = {}
) => {
  const child = spawn(process.execPath, [script], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const { code } = await waitForExit(child);
  clearTimeout(timer);
  return { code, stdout: stdout(), stderr: stderr() };
};

export const startServerProcess = async ({ mongoUri, overrides = {} }) => {
  const port = await findFreePort();
  const publicDir = createTempPublicDir();
  const env = buildTestEnv({
    MONGO_URI: mongoUri,
    APP_PORT: String(port),
    PUBLIC_DIR: publicDir,
    ...overrides,
  });

  const child = spawn(process.execPath, ['src/main.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  const baseUrl = `http://127.0.0.1:${port}`;

  const deadline = Date.now() + 20000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await sleep(100);
    }
  }

  if (!ready) {
    child.kill('SIGKILL');
    removeDir(publicDir);
    throw new Error(`Server did not become ready.\n${stdout()}\n${stderr()}`);
  }

  return {
    env,
    port,
    baseUrl,
    publicDir,
    createClient: () => createHttpClient(baseUrl),
    output: () => ({ stdout: stdout(), stderr: stderr() }),
    stop: async (signal = 'SIGTERM') => {
      child.kill(signal);
      const result = await waitForExit(child);
      removeDir(publicDir);
      return result;
    },
  };
};
