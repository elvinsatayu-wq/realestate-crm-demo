/**
 * Tiny JSON-file database.
 * - Default: persists to data/db.json (override with DB_FILE)
 * - DB_MODE=memory: keeps everything in memory only (handy for testing)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const IN_MEMORY = process.env.DB_MODE === 'memory';
const COLLECTIONS = ['users', 'leads', 'walkins', 'bookings', 'transfers'];

let state = null;

function emptyState() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

function persist() {
  if (IN_MEMORY) return;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  // Write to a temp file first so a crash never leaves a half-written db.json
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/** Loads the JSON file, or builds the initial state from `seed()` when there is none. */
function init(seed) {
  if (!IN_MEMORY && fs.existsSync(DB_FILE)) {
    state = { ...emptyState(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    return;
  }
  state = { ...emptyState(), ...(seed ? seed() : {}) };
  persist();
}

function reset(data = {}) {
  state = { ...emptyState(), ...data };
  persist();
}

function collection(name) {
  if (!state) throw new Error('Database is not initialised');
  if (!state[name]) throw new Error(`Unknown collection: ${name}`);
  return state[name];
}

const all = (name) => [...collection(name)];
const get = (name, id) => collection(name).find((record) => record.id === id) || null;
const find = (name, predicate) => collection(name).filter(predicate);

function insert(name, data) {
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now };
  collection(name).push(record);
  persist();
  return record;
}

function update(name, id, data) {
  const list = collection(name);
  const index = list.findIndex((record) => record.id === id);
  if (index === -1) return null;
  const prev = list[index];
  list[index] = { ...prev, ...data, id, createdAt: prev.createdAt, updatedAt: new Date().toISOString() };
  persist();
  return list[index];
}

function remove(name, id) {
  const list = collection(name);
  const index = list.findIndex((record) => record.id === id);
  if (index === -1) return null;
  const [removed] = list.splice(index, 1);
  persist();
  return removed;
}

/** Replaces a whole collection with a single write (used by migrations). */
function replaceAll(name, records) {
  collection(name);
  state[name] = records;
  persist();
}

module.exports = {
  COLLECTIONS,
  file: DB_FILE,
  inMemory: IN_MEMORY,
  mode: IN_MEMORY ? 'in-memory' : `json file (${path.relative(process.cwd(), DB_FILE)})`,
  init,
  reset,
  all,
  get,
  find,
  insert,
  update,
  remove,
  replaceAll,
};
