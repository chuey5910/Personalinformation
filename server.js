#!/usr/bin/env node
/**
 * CHUEY-Server backend สำหรับ person_dashboard.html (SB1)
 * ใช้ Node.js อย่างเดียว ไม่ต้องติดตั้ง dependency ใด ๆ (ไม่ต้อง npm install)
 *
 * รัน:            node server.js                (พอร์ตเริ่มต้น 8080)
 * เปลี่ยนพอร์ต:   PORT=3000 node server.js
 * เปิด token:     API_TOKEN=รหัสลับ node server.js   (ทุก request ต้องแนบ header x-api-token)
 * ที่เก็บข้อมูล:  data/records.json (เปลี่ยนได้ด้วย DATA_DIR=/path node server.js)
 *
 * API:
 *   GET  /api/health          → {ok:true}
 *   GET  /api/records         → {ok:true, records:[...]}
 *   POST /api/records         body {records:[...]}  upsert ตาม _id → {ok:true, added, updated}
 *   POST /api/records/delete  body {ids:[...]} หรือ {all:true}    → {ok:true, deleted}
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const API_TOKEN = process.env.API_TOKEN || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');
const MAX_BODY = 200 * 1024 * 1024; // 200 MB (records ทั้งชุดรวมรูปภาพ)
const ROOT = __dirname;

// ---------- storage ----------

function loadRecords() {
  try {
    const j = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(j.records) ? j.records : [];
  } catch (e) {
    return [];
  }
}

let records = loadRecords();

function dailyBackup() {
  // สำรองไฟล์เดิมวันละ 1 ครั้ง ก่อนเขียนทับครั้งแรกของวัน
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const d = new Date();
    const tag = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const bak = path.join(DATA_DIR, 'backup-' + tag + '.json');
    if (!fs.existsSync(bak)) fs.copyFileSync(DATA_FILE, bak);
  } catch (e) { /* backup ล้มเหลวไม่ควรขวางการบันทึก */ }
}

function saveRecords() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  dailyBackup();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), records: records }));
  fs.renameSync(tmp, DATA_FILE); // เขียนแบบ atomic กันไฟล์พังถ้าไฟดับกลางคัน
}

// ---------- helpers ----------

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function authorized(req, url) {
  if (!API_TOKEN) return true;
  const h = req.headers['x-api-token'];
  const q = url.searchParams.get('token');
  return h === API_TOKEN || q === API_TOKEN;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function serveStatic(res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/' || p === '') p = '/person_dashboard.html';
  const file = path.normalize(path.join(ROOT, p));
  // กัน path traversal และห้ามเข้าถึงโฟลเดอร์ข้อมูล
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(DATA_DIR + path.sep) || file === DATA_FILE) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext] || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  // CORS preflight (เผื่อเปิดหน้าเว็บจาก origin อื่น/ไฟล์ตรง ๆ)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-token',
      'Access-Control-Max-Age': '86400',
    });
    res.end(); return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req, url)) { sendJSON(res, 401, { ok: false, error: 'unauthorized' }); return; }

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJSON(res, 200, { ok: true, count: records.length }); return;
      }

      if (req.method === 'GET' && url.pathname === '/api/records') {
        sendJSON(res, 200, { ok: true, records: records }); return;
      }

      if (req.method === 'POST' && url.pathname === '/api/records') {
        const data = JSON.parse(await readBody(req) || '{}');
        const incoming = Array.isArray(data.records) ? data.records : [];
        let added = 0, updated = 0;
        const idx = new Map();
        records.forEach((r, i) => { if (r && r._id) idx.set(r._id, i); });
        incoming.forEach((r) => {
          if (!r || typeof r !== 'object') return;
          const id = r._id ? String(r._id) : '';
          if (id && idx.has(id)) { records[idx.get(id)] = r; updated++; }
          else { records.push(r); if (id) idx.set(id, records.length - 1); added++; }
        });
        if (added || updated) saveRecords();
        sendJSON(res, 200, { ok: true, added: added, updated: updated, total: records.length }); return;
      }

      if (req.method === 'POST' && url.pathname === '/api/records/delete') {
        const data = JSON.parse(await readBody(req) || '{}');
        let deleted = 0;
        if (data.all === true) {
          deleted = records.length; records = [];
        } else {
          const ids = new Set((Array.isArray(data.ids) ? data.ids : []).map(String));
          const before = records.length;
          records = records.filter((r) => !(r && r._id && ids.has(String(r._id))));
          deleted = before - records.length;
        }
        if (deleted) saveRecords();
        sendJSON(res, 200, { ok: true, deleted: deleted, total: records.length }); return;
      }

      sendJSON(res, 404, { ok: false, error: 'unknown endpoint' });
    } catch (err) {
      sendJSON(res, 400, { ok: false, error: String(err && err.message || err) });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(res, url.pathname); return; }
  res.writeHead(405); res.end();
});

server.listen(PORT, HOST, () => {
  console.log('SB1 CHUEY-Server พร้อมใช้งาน');
  console.log('  หน้าเว็บ:  http://' + (HOST === '0.0.0.0' ? '<server-ip>' : HOST) + ':' + PORT + '/');
  console.log('  ข้อมูล:    ' + DATA_FILE + ' (ตอนนี้ ' + records.length + ' รายการ)');
  console.log('  token:     ' + (API_TOKEN ? 'เปิดใช้งาน (x-api-token)' : 'ปิด — ตั้ง API_TOKEN=... เพื่อเปิด'));
});
