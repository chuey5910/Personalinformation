#!/usr/bin/env node
/**
 * CHUEY-Server backend สำหรับ person_dashboard.html (SB1)
 * ใช้ Node.js อย่างเดียว ไม่ต้องติดตั้ง dependency ใด ๆ (ไม่ต้อง npm install)
 *
 * รัน:            node server.js                       (พอร์ตเริ่มต้น 8080)
 * เปลี่ยนพอร์ต:   PORT=3000 node server.js
 * สร้าง admin:    ADMIN_USER=admin ADMIN_PASS=รหัสผ่าน node server.js   (สร้างให้ครั้งแรกที่รัน)
 * ที่เก็บข้อมูล:  โฟลเดอร์ data/ (เปลี่ยนได้ด้วย DATA_DIR=/path)
 *
 * สิทธิ์การใช้งาน:
 *   - ต้อง login ก่อนเสมอ (สมัครแล้วรอ admin อนุมัติ)
 *   - เจ้าหน้าที่ (officer): เพิ่มข้อมูลใหม่ + อ่านข้อมูลทั้งหมดได้
 *   - admin เท่านั้น: แก้ไข/ลบข้อมูล, อนุมัติผู้ใช้, ดู audit log
 *   - บันทึกการเข้า-ออกระบบทุกครั้งลง data/audit.log
 *
 * API:
 *   GET  /api/health                    → {ok:true}                      (ไม่ต้อง login)
 *   POST /api/register                  {username,password,name,prov}    (ไม่ต้อง login — สร้างบัญชีสถานะ "รออนุมัติ")
 *   POST /api/login                     {username,password}
 *   POST /api/logout
 *   GET  /api/me                        → ข้อมูลผู้ใช้ที่ login อยู่
 *   GET  /api/records                   → {ok, records:[...]}            (ทุกคนที่ login)
 *   POST /api/records                   {records:[...]}                  (officer: เพิ่มได้อย่างเดียว / admin: เพิ่ม+แก้ไข)
 *   POST /api/records/delete            {ids:[...]} หรือ {all:true}      (admin เท่านั้น)
 *   GET  /api/users                     → รายชื่อผู้ใช้ทั้งหมด            (admin)
 *   POST /api/users/approve             {id, role?}                      (admin)
 *   POST /api/users/reject              {id}                             (admin — ลบบัญชี)
 *   GET  /api/audit?limit=300           → บันทึกการใช้งานล่าสุด           (admin)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
const SESSION_HOURS = parseFloat(process.env.SESSION_HOURS || '12'); // หมดอายุเมื่อไม่ได้ใช้งานนานเท่านี้
const MAX_BODY = 200 * 1024 * 1024;
const ROOT = __dirname;

// ---------- โหลด/บันทึกไฟล์ ----------

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file); // atomic กันไฟล์พังถ้าไฟดับ
}

let records = (loadJSON(RECORDS_FILE, {}).records) || [];
let users = (loadJSON(USERS_FILE, {}).users) || [];
let sessions = loadJSON(SESSIONS_FILE, {});

function dailyBackup() {
  try {
    if (!fs.existsSync(RECORDS_FILE)) return;
    const d = new Date();
    const tag = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const bak = path.join(DATA_DIR, 'backup-' + tag + '.json');
    if (!fs.existsSync(bak)) fs.copyFileSync(RECORDS_FILE, bak);
  } catch (e) { /* backup ล้มเหลวไม่ควรขวางการบันทึก */ }
}
function saveRecords() { dailyBackup(); writeJSON(RECORDS_FILE, { updatedAt: new Date().toISOString(), records: records }); }
function saveUsers() { writeJSON(USERS_FILE, { users: users }); }
function saveSessions() { writeJSON(SESSIONS_FILE, sessions); }

// ---------- audit log (บันทึกการเข้าออก/การกระทำ ทุกครั้ง) ----------

function audit(action, username, detail, req) {
  const entry = {
    time: new Date().toISOString(),
    action: action,
    user: username || '-',
    detail: detail || '',
    ip: (req && (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress))) || '',
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
  } catch (e) { console.error('audit เขียนไม่สำเร็จ:', e.message); }
}
function readAudit(limit) {
  try {
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n');
    return lines.slice(-limit).reverse().map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}

// ---------- ผู้ใช้ / รหัสผ่าน ----------

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}
function newUser(username, password, name, prov, role, status) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: 'u' + crypto.randomBytes(8).toString('hex'),
    username: String(username).trim(),
    name: String(name || '').trim(),
    prov: String(prov || '').trim(),
    role: role,           // 'admin' | 'officer'
    status: status,       // 'approved' | 'pending'
    salt: salt,
    hash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
}
function findUser(username) {
  const u = String(username || '').trim().toLowerCase();
  return users.find((x) => x.username.toLowerCase() === u);
}
function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, prov: u.prov, role: u.role, status: u.status, createdAt: u.createdAt };
}

// สร้าง admin คนแรกจาก environment variable
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  if (!findUser(process.env.ADMIN_USER)) {
    users.push(newUser(process.env.ADMIN_USER, process.env.ADMIN_PASS, 'ผู้ดูแลระบบ', '', 'admin', 'approved'));
    saveUsers();
    console.log('สร้างบัญชี admin แล้ว: ' + process.env.ADMIN_USER);
  }
}

// ---------- session ----------

function createSession(user) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions[sid] = { userId: user.id, username: user.username, created: Date.now(), last: Date.now() };
  saveSessions();
  return sid;
}
function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (!m) return null;
  const s = sessions[m[1]];
  if (!s) return null;
  if (Date.now() - s.last > SESSION_HOURS * 3600 * 1000) { delete sessions[m[1]]; saveSessions(); return null; }
  s.last = Date.now();
  s.sid = m[1];
  const user = users.find((u) => u.id === s.userId);
  if (!user || user.status !== 'approved') return null;
  s.user = user;
  return s;
}
function destroySession(sid) { if (sessions[sid]) { delete sessions[sid]; saveSessions(); } }
// ล้าง session หมดอายุทุกชั่วโมง
setInterval(() => {
  let changed = false;
  Object.keys(sessions).forEach((k) => {
    if (Date.now() - sessions[k].last > SESSION_HOURS * 3600 * 1000) { delete sessions[k]; changed = true; }
  });
  if (changed) saveSessions();
}, 3600 * 1000).unref();

// ---------- helpers ----------

function sendJSON(res, code, obj, extraHeaders) {
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extraHeaders || {});
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
function serveStatic(res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/' || p === '') p = '/person_dashboard.html';
  const file = path.normalize(path.join(ROOT, p));
  // กัน path traversal และห้ามเข้าถึงโฟลเดอร์ข้อมูล
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(DATA_DIR + path.sep) || file === DATA_DIR) {
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

  if (!url.pathname.startsWith('/api/')) {
    if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(res, url.pathname); return; }
    res.writeHead(405); res.end(); return;
  }

  try {
    // ----- endpoint ที่ไม่ต้อง login -----
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJSON(res, 200, { ok: true, count: records.length }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/register') {
      const d = JSON.parse(await readBody(req) || '{}');
      const username = String(d.username || '').trim();
      const password = String(d.password || '');
      if (!/^[a-zA-Z0-9_.@-]{3,40}$/.test(username)) { sendJSON(res, 400, { ok: false, error: 'ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ . @ - ยาว 3-40 ตัว' }); return; }
      if (password.length < 6) { sendJSON(res, 400, { ok: false, error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร' }); return; }
      if (!String(d.name || '').trim()) { sendJSON(res, 400, { ok: false, error: 'กรุณากรอกชื่อ-สกุล' }); return; }
      if (findUser(username)) { sendJSON(res, 400, { ok: false, error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' }); return; }
      const u = newUser(username, password, d.name, d.prov, 'officer', 'pending');
      users.push(u); saveUsers();
      audit('register', username, 'สมัครสมาชิก (' + (u.name || '') + (u.prov ? ' จ.' + u.prov : '') + ') — รออนุมัติ', req);
      sendJSON(res, 200, { ok: true, message: 'สมัครแล้ว — รอ admin อนุมัติก่อนจึงจะเข้าใช้งานได้' }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = findUser(d.username);
      const ok = u && crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hashPassword(d.password || '', u.salt), 'hex'));
      if (!ok) {
        audit('login_failed', String(d.username || '').trim(), 'เข้าสู่ระบบไม่สำเร็จ (รหัสผ่านหรือชื่อผู้ใช้ผิด)', req);
        sendJSON(res, 401, { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); return;
      }
      if (u.status !== 'approved') {
        audit('login_denied', u.username, 'พยายามเข้าสู่ระบบแต่บัญชียังไม่ถูกอนุมัติ', req);
        sendJSON(res, 403, { ok: false, error: 'บัญชียังไม่ถูกอนุมัติโดย admin' }); return;
      }
      const sid = createSession(u);
      audit('login', u.username, 'เข้าสู่ระบบ', req);
      sendJSON(res, 200, { ok: true, user: publicUser(u) }, {
        'Set-Cookie': 'sid=' + sid + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + Math.floor(SESSION_HOURS * 3600),
      }); return;
    }

    // ----- ตั้งแต่ตรงนี้ต้อง login -----
    const sess = getSession(req);
    if (!sess) { sendJSON(res, 401, { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' }); return; }
    const me = sess.user;
    const isAdmin = me.role === 'admin';

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      audit('logout', me.username, 'ออกจากระบบ', req);
      destroySession(sess.sid);
      sendJSON(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); return;
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      sendJSON(res, 200, { ok: true, user: publicUser(me) }); return;
    }

    if (req.method === 'GET' && url.pathname === '/api/records') {
      sendJSON(res, 200, { ok: true, records: records }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/records') {
      const data = JSON.parse(await readBody(req) || '{}');
      const incoming = Array.isArray(data.records) ? data.records : [];
      let added = 0, updated = 0, skipped = 0;
      const idx = new Map();
      records.forEach((r, i) => { if (r && r._id) idx.set(r._id, i); });
      incoming.forEach((r) => {
        if (!r || typeof r !== 'object') return;
        const id = r._id ? String(r._id) : '';
        if (id && idx.has(id)) {
          // นับเฉพาะรายการที่เนื้อหาเปลี่ยนจริง (client ส่งทั้งชุดทุกครั้ง รายการที่ไม่เปลี่ยนไม่ต้องทำอะไร)
          const changed = JSON.stringify(records[idx.get(id)]) !== JSON.stringify(r);
          if (!changed) return;
          if (isAdmin) { records[idx.get(id)] = r; updated++; }
          else skipped++; // officer แก้ไขข้อมูลเดิมไม่ได้
        } else {
          r._createdBy = r._createdBy || me.username;
          records.push(r);
          if (id) idx.set(id, records.length - 1);
          added++;
        }
      });
      if (added || updated) saveRecords();
      if (added || updated || skipped) audit('save_records', me.username, 'เพิ่ม ' + added + ' / แก้ไข ' + updated + ' / ข้าม(ไม่มีสิทธิ์แก้) ' + skipped, req);
      sendJSON(res, 200, { ok: true, added: added, updated: updated, skipped: skipped, total: records.length }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/records/delete') {
      if (!isAdmin) { sendJSON(res, 403, { ok: false, error: 'admin เท่านั้นที่ลบข้อมูลได้' }); return; }
      const data = JSON.parse(await readBody(req) || '{}');
      let deleted = 0;
      if (data.all === true) { deleted = records.length; records = []; }
      else {
        const ids = new Set((Array.isArray(data.ids) ? data.ids : []).map(String));
        const before = records.length;
        records = records.filter((r) => !(r && r._id && ids.has(String(r._id))));
        deleted = before - records.length;
      }
      if (deleted) saveRecords();
      audit('delete_records', me.username, data.all ? ('ลบทั้งหมด ' + deleted + ' รายการ') : ('ลบ ' + deleted + ' รายการ'), req);
      sendJSON(res, 200, { ok: true, deleted: deleted, total: records.length }); return;
    }

    // ----- admin เท่านั้น -----
    if (url.pathname === '/api/users' || url.pathname === '/api/users/approve' || url.pathname === '/api/users/reject' || url.pathname === '/api/audit') {
      if (!isAdmin) { sendJSON(res, 403, { ok: false, error: 'admin เท่านั้น' }); return; }
    }

    if (req.method === 'GET' && url.pathname === '/api/users') {
      sendJSON(res, 200, { ok: true, users: users.map(publicUser) }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/approve') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = users.find((x) => x.id === d.id);
      if (!u) { sendJSON(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' }); return; }
      u.status = 'approved';
      if (d.role === 'admin' || d.role === 'officer') u.role = d.role;
      saveUsers();
      audit('approve_user', me.username, 'อนุมัติผู้ใช้ ' + u.username + ' (สิทธิ์ ' + u.role + ')', req);
      sendJSON(res, 200, { ok: true, user: publicUser(u) }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/reject') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = users.find((x) => x.id === d.id);
      if (!u) { sendJSON(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' }); return; }
      if (u.id === me.id) { sendJSON(res, 400, { ok: false, error: 'ลบบัญชีตัวเองไม่ได้' }); return; }
      users = users.filter((x) => x.id !== u.id);
      Object.keys(sessions).forEach((k) => { if (sessions[k].userId === u.id) delete sessions[k]; });
      saveUsers(); saveSessions();
      audit('reject_user', me.username, 'ลบ/ปฏิเสธผู้ใช้ ' + u.username, req);
      sendJSON(res, 200, { ok: true }); return;
    }

    if (req.method === 'GET' && url.pathname === '/api/audit') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '300', 10) || 300, 2000);
      sendJSON(res, 200, { ok: true, entries: readAudit(limit) }); return;
    }

    sendJSON(res, 404, { ok: false, error: 'unknown endpoint' });
  } catch (err) {
    sendJSON(res, 400, { ok: false, error: String(err && err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('SB1 CHUEY-Server พร้อมใช้งาน');
  console.log('  หน้าเว็บ:  http://' + (HOST === '0.0.0.0' ? '<server-ip>' : HOST) + ':' + PORT + '/');
  console.log('  ข้อมูล:    ' + RECORDS_FILE + ' (ตอนนี้ ' + records.length + ' รายการ)');
  console.log('  ผู้ใช้:    ' + users.length + ' บัญชี (admin: ' + users.filter((u) => u.role === 'admin').length + ')');
  if (!users.some((u) => u.role === 'admin')) {
    console.log('  ⚠ ยังไม่มี admin — รันด้วย ADMIN_USER=admin ADMIN_PASS=รหัสผ่าน node server.js เพื่อสร้าง');
  }
});
