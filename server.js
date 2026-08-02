// KÜTO — serveur de la plateforme de feuilles de caisse
// PIN (4 chiffres) pour l'iPad du comptoir ; mot de passe fort (haché scrypt) pour l'admin.
// N'utilise que les modules intégrés de Node (http, crypto, fs) ; Postgres seulement en production.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = process.env.DATABASE_URL ? require('./store-pg') : require('./store-json');
const PUBLIC = path.join(__dirname, 'public');
const SECRET = process.env.SESSION_SECRET || 'kuto-secret-change-me';

// ---------- Utilitaires ----------
function adminToken(){ return crypto.createHmac('sha256', SECRET).update('admin-v1').digest('hex'); }

function hashPw(pw){
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPw(pw, stored){
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, code, obj){
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req){
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch(e){ resolve({}); } });
  });
}

// Sert l'application (index.html), qu'il soit dans public/ ou à la racine du dépôt.
function serveStatic(req, res){
  const candidates = [
    path.join(PUBLIC, 'index.html'),
    path.join(__dirname, 'index.html')
  ];
  for (const f of candidates){
    try {
      const buf = fs.readFileSync(f);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(buf);
    } catch(e){ /* essaie le prochain */ }
  }
  res.writeHead(404);
  res.end('index.html introuvable');
}

// ---------- Valeurs initiales ----------
async function ensureDefaults(){
  const cfg = await store.getConfig();
  const patch = {};
  if (!cfg.pin) patch.pin = process.env.INITIAL_PIN || '1234';
  if (!cfg.admin_hash) patch.admin_hash = hashPw(process.env.INITIAL_ADMIN_PASSWORD || 'kuto-admin');
  if (Object.keys(patch).length) await store.setConfig(patch);
}

// ---------- Routeur ----------
async function handleApi(req, res, pathname, query){
  const cfg = await store.getConfig();
  const pinOk = (req.headers['x-pin'] || '') === cfg.pin;
  const adminOk = (req.headers['x-admin-token'] || '') === adminToken();

  // Auth
  if (req.method === 'POST' && pathname === '/api/login'){
    const b = await readBody(req);
    return (b.pin || '') === cfg.pin ? send(res, 200, { ok: true }) : send(res, 401, { ok: false });
  }
  if (req.method === 'POST' && pathname === '/api/admin/login'){
    const b = await readBody(req);
    return verifyPw(b.password || '', cfg.admin_hash)
      ? send(res, 200, { ok: true, token: adminToken() })
      : send(res, 401, { ok: false });
  }
  if (req.method === 'POST' && pathname === '/api/admin/settings'){
    if (!adminOk) return send(res, 401, { error: 'Accès admin requis' });
    const b = await readBody(req);
    const patch = {};
    if (b.pin && /^\d{4}$/.test(b.pin)) patch.pin = b.pin;
    if (b.adminPassword && b.adminPassword.length >= 6) patch.admin_hash = hashPw(b.adminPassword);
    if (!Object.keys(patch).length) return send(res, 400, { error: 'PIN 4 chiffres, mot de passe ≥ 6 caractères' });
    await store.setConfig(patch);
    return send(res, 200, { ok: true });
  }

  // Roster
  if (pathname === '/api/roster'){
    if (req.method === 'GET'){ if (!pinOk) return send(res, 401, { error: 'PIN' }); return send(res, 200, await store.getServers()); }
    if (req.method === 'POST'){
      if (!adminOk) return send(res, 401, { error: 'Admin' });
      const b = await readBody(req); const name = (b.name || '').trim();
      if (!name) return send(res, 400, { error: 'Nom requis' });
      return send(res, 200, await store.addServer(name));
    }
  }
  if (pathname.startsWith('/api/roster/') && req.method === 'DELETE'){
    if (!adminOk) return send(res, 401, { error: 'Admin' });
    await store.deleteServer(parseInt(pathname.split('/').pop(), 10));
    return send(res, 200, { ok: true });
  }

  // Feuilles
  if (pathname === '/api/sheets/find' && req.method === 'GET'){
    if (!pinOk) return send(res, 401, { error: 'PIN' });
    return send(res, 200, await store.findSheet(query.date, query.service));
  }
  if (pathname === '/api/sheets'){
    if (req.method === 'GET'){ if (!pinOk) return send(res, 401, { error: 'PIN' }); return send(res, 200, await store.getSheets({ start: query.start, end: query.end })); }
    if (req.method === 'POST'){
      if (!pinOk) return send(res, 401, { error: 'PIN' });
      const b = await readBody(req);
      if (!b || !b.id) return send(res, 400, { error: 'Feuille invalide' });
      return send(res, 200, await store.upsertSheet(b));
    }
  }
  if (pathname.startsWith('/api/sheets/') && req.method === 'DELETE'){
    if (!adminOk) return send(res, 401, { error: 'Admin' });
    await store.deleteSheet(decodeURIComponent(pathname.split('/').pop()));
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/health') return send(res, 200, { ok: true });
  return send(res, 404, { error: 'Route inconnue' });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname.startsWith('/api/')){
    try { await handleApi(req, res, parsed.pathname, parsed.query); }
    catch(e){ console.error(e); send(res, 500, { error: 'Erreur serveur' }); }
  } else {
    serveStatic(req, res);
  }
});

const PORT = process.env.PORT || 3000;
store.init()
  .then(ensureDefaults)
  .then(() => server.listen(PORT, () => console.log('KÜTO en écoute sur le port ' + PORT)))
  .catch(err => { console.error('Erreur de démarrage:', err); process.exit(1); });
