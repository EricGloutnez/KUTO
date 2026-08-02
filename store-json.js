// Stockage local sur fichier JSON — pour le développement / test uniquement.
// (En production sur Render, on utilise Postgres via store-pg.js.)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');
let data = { config: {}, servers: [], sheets: [] };

function load(){
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch(e){ data = { config: {}, servers: [], sheets: [] }; }
  if (!data.config) data.config = {};
  if (!Array.isArray(data.servers)) data.servers = [];
  if (!Array.isArray(data.sheets)) data.sheets = [];
}
function persist(){ fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

module.exports = {
  async init(){ load(); },

  async getConfig(){ return { ...data.config }; },
  async setConfig(patch){ Object.assign(data.config, patch); persist(); },

  async getServers(){ return data.servers.slice(); },
  async addServer(name){
    const id = (data.servers.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
    const item = { id, name };
    data.servers.push(item); persist();
    return item;
  },
  async deleteServer(id){
    data.servers = data.servers.filter(s => s.id !== id); persist();
  },

  async getSheets(range){
    let out = data.sheets.slice();
    if (range && range.start) out = out.filter(s => s.date >= range.start);
    if (range && range.end) out = out.filter(s => s.date <= range.end);
    return out;
  },
  async findSheet(date, service){
    const all = data.sheets.filter(s => s.date === date && s.service === service);
    return all.length ? all[all.length - 1] : null;
  },
  async upsertSheet(sheet){
    const i = data.sheets.findIndex(s => s.id === sheet.id);
    if (i >= 0) data.sheets[i] = sheet; else data.sheets.push(sheet);
    persist();
    return sheet;
  }
};
