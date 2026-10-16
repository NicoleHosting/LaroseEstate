import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(SOURCE_DIR, 'schema.sql');

export const STATE_VERSION = 1;

export function createInitialState() {
  return {
    schemaVersion: STATE_VERSION,
    sessions: {},
    players: {},
    tokens: {},
    messages: {},
    investigations: {},
    accusations: {},
    audit: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeState(value) {
  const base = createInitialState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const state = { ...base, ...value };
  for (const key of ['sessions', 'players', 'tokens', 'messages', 'investigations', 'accusations']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  }
  if (!Array.isArray(state.audit)) state.audit = [];
  return state;
}

class JsonStateDriver {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.state = createInitialState();
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = normalizeState(JSON.parse(await fs.readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Could not read JSON data store: ${error.message}`);
      await this.#write(this.state);
    }
    return this;
  }

  async #write(state) {
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const contents = `${JSON.stringify(state, null, 2)}\n`;
    await fs.writeFile(temporary, contents, { mode: 0o600 });
    try {
      await fs.rename(temporary, this.filePath);
    } catch (error) {
      // Some mounted Windows/sandbox filesystems disallow atomic renames even
      // within one directory. Preserve local persistence with a direct-write
      // fallback; PostgreSQL remains the production concurrency path.
      if (!['EACCES', 'EPERM', 'ENOSYS'].includes(error.code)) throw error;
      await fs.writeFile(this.filePath, contents, { mode: 0o600 });
      await fs.unlink(temporary).catch(() => undefined);
    }
  }

  async read() {
    await this.queue;
    return clone(this.state);
  }

  async mutate(mutator) {
    const operation = this.queue.then(async () => {
      const next = clone(this.state);
      const result = await mutator(next);
      next.schemaVersion = STATE_VERSION;
      next.updatedAt = new Date().toISOString();
      await this.#write(next);
      this.state = next;
      return clone(result);
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async close() {
    await this.queue;
  }
}

class PostgresStateDriver {
  constructor(databaseUrl, options = {}) {
    this.databaseUrl = databaseUrl;
    this.ssl = options.ssl;
    this.pool = null;
  }

  async init() {
    const { Pool } = await import('pg');
    this.pool = new Pool({ connectionString: this.databaseUrl, ssl: this.ssl });
    const schema = await fs.readFile(SCHEMA_PATH, 'utf8');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(schema);
      await client.query(
        `INSERT INTO larose_app_state (singleton, version, document)
         VALUES (TRUE, $1, $2::jsonb)
         ON CONFLICT (singleton) DO NOTHING`,
        [STATE_VERSION, JSON.stringify(createInitialState())],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this;
  }

  async read() {
    const { rows } = await this.pool.query(
      'SELECT document FROM larose_app_state WHERE singleton = TRUE',
    );
    return normalizeState(rows[0]?.document);
  }

  async mutate(mutator) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT version, document FROM larose_app_state WHERE singleton = TRUE FOR UPDATE',
      );
      const current = normalizeState(rows[0]?.document);
      const result = await mutator(current);
      current.schemaVersion = STATE_VERSION;
      current.updatedAt = new Date().toISOString();
      await client.query(
        `UPDATE larose_app_state
         SET version = version + 1, document = $1::jsonb, updated_at = NOW()
         WHERE singleton = TRUE`,
        [JSON.stringify(current)],
      );
      await client.query('COMMIT');
      return clone(result);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async appendAudit(event) {
    await this.pool.query(
      `INSERT INTO larose_audit_events (session_id, actor_id, event_type, payload)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
      [event.sessionId ?? null, event.actorId ?? null, event.type, JSON.stringify(event.payload ?? {})],
    );
  }

  async close() {
    await this.pool?.end();
  }
}

export class StateStore {
  constructor(driver, kind) {
    this.driver = driver;
    this.kind = kind;
  }

  read() {
    return this.driver.read();
  }

  mutate(mutator) {
    return this.driver.mutate(mutator);
  }

  async audit(event) {
    if (this.driver.appendAudit) {
      await this.driver.appendAudit(event);
      return;
    }
    await this.mutate((state) => {
      state.audit.push({ id: crypto.randomUUID(), ...event, createdAt: new Date().toISOString() });
      if (state.audit.length > 2000) state.audit.splice(0, state.audit.length - 2000);
    });
  }

  close() {
    return this.driver.close();
  }
}

export async function createStore(options = {}) {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (databaseUrl) {
    const rejectUnauthorized = (options.pgSslMode ?? process.env.PGSSLMODE) !== 'disable';
    const driver = new PostgresStateDriver(databaseUrl, {
      ssl: rejectUnauthorized ? { rejectUnauthorized: false } : false,
    });
    await driver.init();
    return new StateStore(driver, 'postgres');
  }

  const filePath = options.dataFile
    ?? process.env.DATA_PATH
    ?? process.env.DATA_FILE
    ?? path.resolve(SOURCE_DIR, '..', '.data', 'larose.json');
  const driver = new JsonStateDriver(filePath);
  await driver.init();
  return new StateStore(driver, 'json');
}
