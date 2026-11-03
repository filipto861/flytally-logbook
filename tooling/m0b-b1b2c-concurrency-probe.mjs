#!/usr/bin/env node
// Synthetic M0-B PG16 diagnostic only; no application schema/runtime changes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const EXPERIMENT_FLAG = 'M0B_DISPOSABLE_PG16_CONFIRMED';
const DATABASE_NAME_RE = /^flytally_m0b_disposable_[a-z0-9_]+$/;
const MARKER_PREFIX = '__flytally_m0b_marker_';
const scriptIsMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

export function assertIsolatedTarget(env = process.env) {
  if (env.FLYTALLY_M0B_OWNED_PG16 !== EXPERIMENT_FLAG) {
    throw new Error('M0B diagnostic disabled: explicitly owned disposable PostgreSQL16 target flag is required.');
  }
  const raw = String(env.DATABASE_URL ?? '');
  let url;
  try { url = new URL(raw); } catch { throw new Error('M0B diagnostic requires a PostgreSQL DATABASE_URL.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1') {
    throw new Error('M0B diagnostic rejects non-127.0.0.1 PostgreSQL targets.');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!DATABASE_NAME_RE.test(databaseName) || !url.port) {
    throw new Error('M0B diagnostic requires a purpose-named disposable database and explicit TCP port.');
  }
  if (url.search || url.hash) throw new Error('M0B diagnostic forbids connection-string overrides.');
  return { url: raw, databaseName, port: Number(url.port) };
}

function makeCliEnv(env) {
  const out = { ...env, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable' };
  for (const key of Object.keys(out)) {
    if (/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|PASSFILE|USER|PASSWORD|REQUIRESSL)$/i.test(key)) delete out[key];
  }
  return out;
}

function sqlSync(target, statement, { allowFailure = false } = {}) {
  const result = spawnSync(target.command, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', target.url, '-c', statement], {
    encoding: 'utf8', timeout: 10000, env: target.env,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error('M0B test-only psql command failed: ' + result.stderr);
  return { status: result.status, stdout: String(result.stdout ?? '').trim(), stderr: String(result.stderr ?? '') };
}

class Session {
  constructor(target, label) {
    this.label = label;
    this.child = spawn(target.command, ['-X', '-w', '-qAt', '-P', 'pager=off', '-v', 'ON_ERROR_STOP=1', '-d', target.url], {
      stdio: ['pipe', 'pipe', 'pipe'], env: target.env,
    });
    this.active = null;
    this.output = '';
    this.errorOutput = '';
    this.closed = false;
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.output += chunk;
      const job = this.active;
      if (!job) return;
      const index = this.output.indexOf(job.marker);
      if (index !== -1) {
        const output = this.output.slice(0, index).trim();
        this.output = this.output.slice(index + job.marker.length);
        this.active = null;
        clearTimeout(job.timer);
        job.resolve(output);
      }
    });
    this.child.stderr.on('data', chunk => { this.errorOutput += chunk; });
    this.child.on('error', error => { this._reject(error); });
    this.child.on('close', code => {
      this.closed = true;
      this._reject(new Error(`M0B PostgreSQL session ${label} closed (${code}): ${this.errorOutput.trim()}`));
    });
  }
  _reject(error) {
    const job = this.active;
    this.active = null;
    if (job) { clearTimeout(job.timer); job.reject(error); }
  }
  send(sql, timeoutMs = 10000) {
    if (this.closed || this.active) throw new Error(`M0B session ${this.label} is closed or busy.`);
    const marker = `${MARKER_PREFIX}${randomUUID().replaceAll('-', '')}__`;
    const query = sql.trim();
    if (!query || query.includes(MARKER_PREFIX)) throw new Error('Invalid diagnostic statement.');
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._reject(new Error(`M0B session ${this.label} timed out; last stderr: ${this.errorOutput.trim()}`));
        this.child.kill();
      }, timeoutMs);
      this.active = { marker, timer, resolve, reject };
      this.child.stdin.write(`${query.replace(/;\s*$/, '')};\nSELECT '${marker}';\n`);
    });
    return promise;
  }
  async run(sql, timeoutMs) { return this.send(sql, timeoutMs); }
  async close() {
    if (this.closed) return;
    const stopped = new Promise(resolve => this.child.once('close', resolve));
    this.child.kill();
    await Promise.race([stopped, sleep(1000)]);
    if (!this.closed) {
      this.child.kill('SIGKILL');
      await Promise.race([stopped, sleep(1000)]);
    }
    if (!this.closed) throw new Error(`M0B session ${this.label} did not exit during cleanup`);
  }
}

async function assertStillPending(promise, label, ms = 160) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await sleep(ms);
  assert.equal(settled, false, label + ' should be blocked while an incompatible lock is held');
}

async function withSessions(target, labels, testFn) {
  const sessions = labels.map(label => new Session(target, label));
  try { return await testFn(...sessions); }
  finally { await Promise.all(sessions.map(s => s.close())); }
}

export async function runProbe(env = process.env) {
  const cfg = assertIsolatedTarget(env);
  const target = { ...cfg, command: String(env.FLYTALLY_PSQL || 'psql'), env: makeCliEnv(env) };
  const identity = sqlSync(target, "SELECT current_database() || '|' || current_user || '|' || inet_server_addr() || '|' || inet_server_port() || '|' || current_setting('server_version_num')").stdout;
  const [db, user, address, port, version] = identity.split('|');
  assert.equal(db, cfg.databaseName, 'Actual connected PostgreSQL database must match target');
  assert.equal(user, 'flytally', 'Diagnostic accepts only purpose-specific flytally role');
  // Hosted CI connects to 127.0.0.1:5432, but PostgreSQL's Docker bridge
  // reports a private container-side server address (not the host loopback).
  // This exception is CI-only and never relaxes the client URL loopback guard.
  const ciDockerBridge = env.CI === 'true' && /^(?:10\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.|192\\.168\\.)/.test(address);
  assert.ok(address === '127.0.0.1' || ciDockerBridge, 'PostgreSQL server must be local or CI-private bridge');
  assert.equal(Number(port), cfg.port, 'PostgreSQL backend port must match target');
  assert.ok(/^16\d{4}$/.test(version), 'Only real PostgreSQL16 is acceptable');
  const schema = 'ft_m0b_' + randomUUID().replaceAll('-', '');
  const q = '"' + schema + '"';
  let created = false;
  const reports = [];
  try {
    sqlSync(target, `CREATE SCHEMA ${q}`);
    created = true;
    sqlSync(target, `
      CREATE TABLE ${q}.account_gates (user_id bigint PRIMARY KEY);
      INSERT INTO ${q}.account_gates VALUES (1),(2);
      CREATE TABLE ${q}.model_flights (id bigint PRIMARY KEY,user_id bigint NOT NULL,note text NOT NULL);
      INSERT INTO ${q}.model_flights VALUES (41,1,'initial'),(42,2,'initial');
      CREATE FUNCTION ${q}.gate_on_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM 1 FROM ${q}.account_gates WHERE user_id = NEW.user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account gate missing'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER model_gate BEFORE UPDATE ON ${q}.model_flights
      FOR EACH ROW EXECUTE FUNCTION ${q}.gate_on_update();
      CREATE TABLE ${q}.model_events (
        row_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id bigint NOT NULL,
        kind text NOT NULL CHECK(kind IN ('flight','fstd')),
        event_uid uuid NOT NULL,
        fingerprint text,
        UNIQUE(user_id,kind,event_uid)
      );
    `);

    await withSessions(target, ['bad-A','bad-B'], async (a,b) => {
      await a.run(`BEGIN; SELECT id FROM ${q}.model_flights WHERE id=41 FOR UPDATE`);
      await b.run(`BEGIN; SELECT user_id FROM ${q}.account_gates WHERE user_id=1 FOR UPDATE`);
      const blockedA = a.send(`UPDATE ${q}.model_flights SET note='bad-a' WHERE id=41`);
      await assertStillPending(blockedA, 'Inverted update A');
      const blockedB = b.send(`UPDATE ${q}.model_flights SET note='bad-b' WHERE id=41`);
      const outcomes = await Promise.allSettled([blockedA, blockedB]);
      assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1, 'Expected one deadlock victim');
      assert.match(a.errorOutput + b.errorOutput, /deadlock detected/i);
    });
    assert.equal(sqlSync(target, `SELECT note FROM ${q}.model_flights WHERE id=41`).stdout, 'initial');
    reports.push('PASS synthetic inverted-lock-order deadlock reproduced');

    await withSessions(target, ['good-A','good-B','unrelated-C'], async (a,b,c) => {
      await a.run(`BEGIN; SELECT user_id FROM ${q}.account_gates WHERE user_id=1 FOR UPDATE`);
      await a.run(`UPDATE ${q}.model_flights SET note='first-commit' WHERE id=41`);
      await b.run('BEGIN');
      const waiting = b.send(`SELECT user_id FROM ${q}.account_gates WHERE user_id=1 FOR UPDATE`);
      await assertStillPending(waiting, 'Same-user prelock B');
      await c.run(`BEGIN; SELECT user_id FROM ${q}.account_gates WHERE user_id=2 FOR UPDATE`);
      await c.run(`UPDATE ${q}.model_flights SET note='unrelated-commit' WHERE id=42`);
      await c.run('COMMIT');
      await a.run('COMMIT');
      await waiting;
      const postLock = await b.run(`SELECT note FROM ${q}.model_flights WHERE id=41`);
      assert.equal(postLock, 'first-commit', 'Fresh statement after gate must see first commit');
      await b.run(`UPDATE ${q}.model_flights SET note='second-commit' WHERE id=41`);
      await b.run('COMMIT');
    });
    assert.equal(sqlSync(target, `SELECT note FROM ${q}.model_flights WHERE id=41`).stdout, 'second-commit');
    assert.equal(sqlSync(target, `SELECT note FROM ${q}.model_flights WHERE id=42`).stdout, 'unrelated-commit');
    reports.push('PASS account-scoped first lock + fresh post-lock read; unrelated writer succeeds');

    const uid = 'e7c308e2-9cd8-4cc8-a58f-a3f4d0b0197a';
    await withSessions(target, ['identity-A','identity-B'], async (a,b) => {
      await a.run('BEGIN');
      await a.run(`INSERT INTO ${q}.model_events(user_id,kind,event_uid,fingerprint) VALUES (1,'flight','${uid}','same-fingerprint')`);
      await b.run('BEGIN');
      const waiting = b.send(`INSERT INTO ${q}.model_events(user_id,kind,event_uid,fingerprint) VALUES (1,'flight','${uid}','same-fingerprint')`);
      await assertStillPending(waiting, 'Concurrent duplicate UID insert');
      await a.run('COMMIT');
      const outcome = await Promise.allSettled([waiting]);
      assert.equal(outcome[0].status, 'rejected', 'Database must reject identical account/kind/event UID');
      assert.match(b.errorOutput, /duplicate key value violates unique constraint/i);
    });
    assert.equal(sqlSync(target, `SELECT count(*) FROM ${q}.model_events WHERE user_id=1 AND kind='flight' AND event_uid='${uid}'`).stdout, '1');
    reports.push('PASS concurrent duplicate identity rejected by database UNIQUE');

    sqlSync(target, `INSERT INTO ${q}.model_events(user_id,kind,event_uid,fingerprint) VALUES
      (1,'flight','257d2c5a-c2e8-4759-9376-6e240e4e1ca2','same-fingerprint'),
      (2,'flight','${uid}','same-fingerprint');`);
    assert.equal(sqlSync(target, `SELECT count(*) FROM ${q}.model_events WHERE user_id=1 AND fingerprint='same-fingerprint'`).stdout, '2');
    assert.equal(sqlSync(target, `SELECT count(*) FROM ${q}.model_events WHERE user_id=2 AND event_uid='${uid}'`).stdout, '1');
    const missingUid = sqlSync(target, `INSERT INTO ${q}.model_events(user_id,kind,event_uid,fingerprint) VALUES (1,'flight',NULL,'empty')`, { allowFailure: true });
    assert.notEqual(missingUid.status, 0);
    assert.match(missingUid.stderr, /null value in column.*event_uid/i);
    reports.push('PASS heuristic fingerprint duplicates allowed; null UID rejected; tenant-scoped identity');
    return { reports, pg16: version, schema, target: cfg.databaseName };
  } finally {
    if (created) sqlSync(target, `DROP SCHEMA ${q} CASCADE`);
  }
}

if (scriptIsMain) {
  runProbe().then(result => {
    for (const message of result.reports) console.log(message);
    console.log(`M0-B SYNTHETIC DIAGNOSTIC PASS: ${result.reports.length} scenarios (PostgreSQL ${result.pg16}, disposable schema cleaned).`);
  }).catch(error => {
    console.error('M0-B SYNTHETIC DIAGNOSTIC FAIL:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
