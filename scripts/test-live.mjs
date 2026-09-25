// Runs the real API as an external service. Never imports its source or reads .env.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootArgument = process.argv.indexOf("--api-root");
if (rootArgument < 0 || !process.argv[rootArgument + 1]) {
  console.error(
    "Usage: pnpm test:live --api-root /absolute/path/to/sayadaliyati-api",
  );
  process.exit(1);
}
const apiRoot = resolve(process.argv[rootArgument + 1]);
const initSql = join(apiRoot, "infrastructure/docker/postgres-init.sql");
if (!existsSync(initSql) || !existsSync(join(apiRoot, "node_modules"))) {
  console.error(
    "An installed independent API checkout is required. No repository is downloaded automatically.",
  );
  process.exit(1);
}
const children = [];
const containers = [];
let cleaning;
const baseEnv = {
  ...process.env,
  PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
};
// Strip inherited service settings. Explicit local values are supplied below.
for (const key of Object.keys(baseEnv))
  if (
    /^(DATABASE_|MIGRATION_|TEST_|REDIS_|AUTH_|DOCUMENT_STORAGE_|API_BASE_URL$|WEB_ORIGIN$|WEB_SESSION_|NEXT_PUBLIC_)/.test(
      key,
    )
  )
    delete baseEnv[key];
const pgName = `saydaliyati-web-live-pg-${process.pid}`;
const redisName = `saydaliyati-web-live-redis-${process.pid}`;
async function run(
  label,
  file,
  args,
  { cwd = webRoot, env = baseEnv, timeout = 120000 } = {},
) {
  console.log(label);
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    // Output may include third-party connection diagnostics; do not echo it.
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", () => {});
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error(`${label}: could not start`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(output.trim());
      else {
        if (label === "Running live browser tests")
          console.error(
            output
              .split("\n")
              .filter((line) =>
                /Error:|Expected:|Received:|> \d+|at .*portal.spec|failed \(/.test(
                  line,
                ),
              )
              .join("\n"),
          );
        reject(new Error(`${label}: failed (exit ${code ?? "signal"})`));
      }
    });
  });
}
function start(file, args, cwd, env) {
  const child = spawn(file, args, {
    cwd,
    env,
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
  });
  children.push(child);
  return child;
}
async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise) =>
    server.listen(0, "127.0.0.1", resolvePromise),
  );
  const port = server.address().port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}
async function ready(url, processHandle) {
  for (let n = 0; n < 80; n++) {
    if (processHandle.exitCode !== null)
      throw new Error("Local service exited before becoming ready");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error("Local service readiness timed out");
}
async function cleanup() {
  if (cleaning) return cleaning;
  cleaning = (async () => {
    for (const child of children)
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
    await delay(350);
    for (const child of children)
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    for (const name of containers.reverse())
      spawnSync("docker", ["rm", "-f", name], {
        stdio: "ignore",
        timeout: 15000,
      });
    console.log("Disposable containers and local test processes removed.");
  })();
  return cleaning;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void cleanup().then(() => process.exit(130));
  });
try {
  const env = {
    ...baseEnv,
    POSTGRES_USER: "saydaliyati_owner",
    POSTGRES_DB: "saydaliyati",
    POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
    APP_DB_PASSWORD: randomBytes(24).toString("hex"),
  };
  containers.push(pgName);
  await run(
    "Starting isolated PostgreSQL",
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      pgName,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER",
      "-e",
      "POSTGRES_DB",
      "-e",
      "POSTGRES_PASSWORD",
      "-e",
      "APP_DB_PASSWORD",
      "-v",
      `${initSql}:/docker-entrypoint-initdb.d/01-app-role.sql:ro`,
      "postgres:17-alpine",
    ],
    { env },
  );
  containers.push(redisName);
  await run("Starting isolated Redis", "docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    redisName,
    "-p",
    "127.0.0.1::6379",
    "redis:8-alpine",
    "redis-server",
    "--save",
    "",
    "--appendonly",
    "no",
  ]);
  const pgPort = (
    await run("Resolving PostgreSQL test port", "docker", [
      "port",
      pgName,
      "5432/tcp",
    ])
  )
    .split(":")
    .at(-1);
  const redisPort = (
    await run("Resolving Redis test port", "docker", [
      "port",
      redisName,
      "6379/tcp",
    ])
  )
    .split(":")
    .at(-1);
  for (let n = 0; n < 50; n++) {
    const probe = spawnSync(
      "docker",
      [
        "exec",
        pgName,
        "pg_isready",
        "-U",
        "saydaliyati_owner",
        "-d",
        "saydaliyati_test",
      ],
      { stdio: "ignore" },
    );
    if (probe.status === 0) break;
    if (n === 49) throw new Error("Test database did not become ready");
    await delay(400);
  }
  const owner = `postgresql://saydaliyati_owner:${env.POSTGRES_PASSWORD}@127.0.0.1:${pgPort}/saydaliyati_test`;
  const runtime = `postgresql://saydaliyati_app:${env.APP_DB_PASSWORD}@127.0.0.1:${pgPort}/saydaliyati_test`;
  const serviceEnv = {
    ...baseEnv,
    NODE_ENV: "test",
    MIGRATION_DATABASE_URL: owner,
    DATABASE_URL: runtime,
    AUTH_SECRET: randomBytes(32).toString("hex"),
    REDIS_URL: `redis://127.0.0.1:${redisPort}/0`,
  };
  await run("Building existing API packages", "pnpm", ["build"], {
    cwd: apiRoot,
    env: serviceEnv,
  });
  await run(
    "Applying migrations only to disposable database",
    "pnpm",
    ["exec", "prisma", "migrate", "deploy"],
    { cwd: join(apiRoot, "packages/database"), env: serviceEnv },
  );
  await run(
    "Applying restricted runtime grants",
    process.execPath,
    ["scripts/grant-local.mjs"],
    { cwd: join(apiRoot, "packages/database"), env: serviceEnv },
  );
  await run(
    "Seeding five synthetic DEMO catalog entries",
    process.execPath,
    ["scripts/seed-catalog.mjs"],
    { cwd: join(apiRoot, "packages/database"), env: serviceEnv },
  );
  const apiPort = await freePort();
  const webPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const api = start(
    process.execPath,
    ["dist/main.js"],
    join(apiRoot, "apps/api"),
    { ...serviceEnv, HOST: "127.0.0.1", PORT: String(apiPort) },
  );
  await ready(`${apiUrl}/api/v1/health/ready`, api);
  start(
    process.execPath,
    ["dist/reminders/main.js"],
    join(apiRoot, "apps/api"),
    serviceEnv,
  );
  // Next's explicit environment overrides any user .env file. Both services are loopback-only.
  const webEnv = {
    ...baseEnv,
    NODE_ENV: "development",
    API_BASE_URL: `${apiUrl}/api/v1`,
    WEB_ORIGIN: webUrl,
    REDIS_URL: `redis://127.0.0.1:${redisPort}/2`,
    WEB_SESSION_TTL_SECONDS: "3600",
  };
  const web = start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    webRoot,
    webEnv,
  );
  await ready(`${webUrl}/api/session`, web);
  console.log(
    "Real local API, reminder worker and browser BFF are ready. Running synthetic acceptance tests.",
  );
  const result = await run(
    "Running live browser tests",
    "pnpm",
    ["exec", "playwright", "test", "--config", "playwright.live.config.ts"],
    {
      env: {
        ...webEnv,
        LIVE_API_URL: `${apiUrl}/api/v1`,
        LIVE_WEB_URL: webUrl,
      },
      timeout: 360000,
    },
  );
  // Playwright only prints scenario names/timing; tests never print credentials/payloads.
  console.log(
    result
      .split("\n")
      .filter((line) => /passed|failed|skipped/.test(line))
      .join("\n"),
  );
  console.log(
    "Live local acceptance completed without using configured remote databases or accounts.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Local integration failed",
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}
