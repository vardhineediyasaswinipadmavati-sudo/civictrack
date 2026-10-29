import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }
  if (process.env.NODE_ENV === 'test') {
    return path.resolve(__dirname, '../../data/civictrack.test.sqlite');
  }
  return path.resolve(__dirname, '../../data/civictrack.sqlite');
}

let sqlDb = null;
let currentDbPath = null;

// Debounced save to disk for high performance and durability
function persistDb() {
  if (!sqlDb || !currentDbPath) return;
  try {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(currentDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(currentDbPath, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

export function saveNow() {
  persistDb();
}

export function closeDb() {
  if (sqlDb) {
    persistDb();
    sqlDb.close();
    sqlDb = null;
    currentDbPath = null;
  }
}

export async function getDb(explicitPath = null) {
  const targetPath = explicitPath ? path.resolve(explicitPath) : getDbPath();

  if (sqlDb && currentDbPath === targetPath) {
    return dbWrapper;
  }

  if (sqlDb && currentDbPath !== targetPath) {
    closeDb();
  }

  currentDbPath = targetPath;
  const SQL = await initSqlJs();

  if (fs.existsSync(currentDbPath)) {
    try {
      const fileBuffer = fs.readFileSync(currentDbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing database file, creating a new one.', e);
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
    persistDb();
  }

  // Enable foreign keys
  sqlDb.run('PRAGMA foreign_keys = ON;');

  return dbWrapper;
}

const dbWrapper = {
  // Execute raw DDL or multi-statement SQL
  exec(sql) {
    sqlDb.exec(sql);
    persistDb();
  },

  // Return all matching rows as array of objects
  all(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  },

  // Return single matching row as object or null
  get(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  },

  // Execute INSERT, UPDATE, DELETE and return { changes, lastInsertRowid }
  run(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();

    const changes = sqlDb.getRowsModified();
    const lastIdRow = this.get('SELECT last_insert_rowid() AS id;');
    const lastInsertRowid = lastIdRow ? lastIdRow.id : 0;

    persistDb();

    return { changes, lastInsertRowid };
  },

  save() {
    persistDb();
  }
};

export default dbWrapper;
