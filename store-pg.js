// Stockage PostgreSQL — utilisé en production (Render, Neon, Supabase…).
// Activé automatiquement dès que la variable d'environnement DATABASE_URL est présente.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // requis par la plupart des Postgres infonuagiques
});

module.exports = {
  async init(){
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sheets (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        service TEXT NOT NULL,
        data JSONB NOT NULL,
        saved_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sheets_date ON sheets(date);
    `);
  },

  async getConfig(){
    const r = await pool.query('SELECT key, value FROM config');
    const cfg = {};
    r.rows.forEach(row => { cfg[row.key] = row.value; });
    return cfg;
  },
  async setConfig(patch){
    for (const [k, v] of Object.entries(patch)){
      await pool.query(
        `INSERT INTO config(key, value) VALUES($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, String(v)]
      );
    }
  },

  async getServers(){
    const r = await pool.query('SELECT id, name FROM servers ORDER BY id');
    return r.rows;
  },
  async addServer(name){
    const r = await pool.query('INSERT INTO servers(name) VALUES($1) RETURNING id, name', [name]);
    return r.rows[0];
  },
  async deleteServer(id){
    await pool.query('DELETE FROM servers WHERE id = $1', [id]);
  },

  async getSheets(range){
    let q = 'SELECT data FROM sheets';
    const cond = [], params = [];
    if (range && range.start){ params.push(range.start); cond.push('date >= $' + params.length); }
    if (range && range.end){ params.push(range.end); cond.push('date <= $' + params.length); }
    if (cond.length) q += ' WHERE ' + cond.join(' AND ');
    q += ' ORDER BY date, service';
    const r = await pool.query(q, params);
    return r.rows.map(row => row.data);
  },
  async findSheet(date, service){
    const r = await pool.query(
      'SELECT data FROM sheets WHERE date = $1 AND service = $2 ORDER BY saved_at DESC LIMIT 1',
      [date, service]
    );
    return r.rows.length ? r.rows[0].data : null;
  },
  async upsertSheet(sheet){
    await pool.query(
      `INSERT INTO sheets(id, date, service, data) VALUES($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, date = EXCLUDED.date, service = EXCLUDED.service`,
      [sheet.id, sheet.date, sheet.service, JSON.stringify(sheet)]
    );
    return sheet;
  },
  async deleteSheet(id){
    await pool.query('DELETE FROM sheets WHERE id = $1', [id]);
  }
};
