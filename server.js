#!/usr/bin/env node
/**
 * Server backend สำหรับ person_dashboard.html (SB1)
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
const LINKS_FILE = path.join(DATA_DIR, 'links.json'); // ผลการยืนยันของ admin ว่าเป็นคนเดียวกัน/คนละคน
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
let links = (loadJSON(LINKS_FILE, {}).links) || [];

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
function saveLinks() { writeJSON(LINKS_FILE, { updatedAt: new Date().toISOString(), links: links }); }

// ---------- ระดับสิทธิ์และการยืนยันข้อมูล ----------
//   officer    เจ้าหน้าที่        บันทึกได้ → เข้าสถานะ "รอยืนยัน" / แก้ไขข้อมูลที่ยืนยันแล้ว → เป็น "ฉบับแก้ไขรอยืนยัน"
//   prov_head  หน.ส.จว.          ยืนยัน/ส่งกลับ ได้เฉพาะจังหวัดที่ประจำการ (ข้อมูลที่ตนเองบันทึกในจังหวัดตนเอง ไม่ต้องรอยืนยัน)
//   desk_head  หัวหน้าโต๊ะข่าว กก. ยืนยัน/ส่งกลับ ได้ทุกจังหวัด + ตรวจสอบบุคคลซ้ำ (ลบไม่ได้)
//   admin      แอดมิน             ทุกอย่าง
// สถานะข้อมูล (_status): 'verified' ใช้งาน/ค้นหาได้ · 'pending' รอยืนยัน · 'returned' ส่งกลับแก้ไข
const ROLES = ['admin', 'desk_head', 'prov_head', 'officer'];
const META = ['_status', '_verifiedBy', '_verifiedAt', '_edit', '_return', '_createdAt'];
function isVerifier(u) { return u.role === 'admin' || u.role === 'desk_head' || u.role === 'prov_head'; }
function canVerifyRec(u, r) { if (u.role === 'admin' || u.role === 'desk_head') return true; if (u.role === 'prov_head') return String(r.pv || '') === String(u.prov || ''); return false; }
function stripMeta(r) { const o = {}; Object.keys(r || {}).forEach((k) => { if (META.indexOf(k) < 0) o[k] = r[k]; }); return o; }
function copyMeta(from, to) { META.forEach((k) => { if (from[k] !== undefined) to[k] = from[k]; else delete to[k]; }); }
function visibleTo(u, r) {
  if (!r) return false;
  if (u.role === 'admin' || u.role === 'desk_head') return true;
  const st = r._status || 'verified';
  if (st === 'verified') return true;
  if (r._createdBy === u.username) return true;
  if (u.role === 'prov_head' && String(r.pv || '') === String(u.prov || '')) return true;
  return false;
}
function viewOf(u, r) {
  // ฉบับแก้ไขรอยืนยัน เห็นได้เฉพาะผู้ตรวจที่มีสิทธิ์ และผู้ที่ส่งแก้ไข
  if (r._edit && !(canVerifyRec(u, r) || r._edit.by === u.username)) { const o = Object.assign({}, r); delete o._edit; return o; }
  return r;
}
function recLabel(r) { const t = r.rtype || 'watch'; if (t === 'watch' || t === 'vip') return ((r.fn || '') + ' ' + (r.ln || '')).trim(); if (t === 'place') return r.pl_name || ''; if (t === 'org') return r.org_name || ''; if (t === 'case') return r.case_subject || ''; if (t === 'border') return r.bd_loc || ''; if (t === 'activity') return r.act_name || r.ac_name || ''; return r._id || ''; }
// ข้อมูลเดิมทั้งหมดถือว่ายืนยันแล้ว (ตามที่ admin ตกลง) — เติมสถานะให้ครั้งเดียว
(function markExistingVerified() {
  let n = 0;
  records.forEach((r) => { if (r && !r._status) { r._status = 'verified'; r._verifiedBy = r._verifiedBy || 'ข้อมูลเดิม'; n++; } });
  if (n) { saveRecords(); audit('mark_verified', 'system', 'ตั้งสถานะยืนยันแล้วให้ข้อมูลเดิม ' + n + ' รายการ (เริ่มใช้ระบบตรวจยืนยัน)', null); }
})();

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
// ---------- ตัดคำนำหน้าชื่อ (นาย นาง นางสาว น.ส. นส.) ออกจากช่องชื่อ ----------
// คำนำหน้าไม่ใช่ชื่อ: ย้ายไปเก็บที่ช่อง title (ถ้าว่าง) แล้วตัดออกจากชื่อ
// กันตัดผิด: ส่วนที่เหลือต้องขึ้นต้นด้วยพยัญชนะ/สระหน้า/ตัวอักษรละติน (เช่น "นางาม" จะไม่ถูกตัด)
const NAME_PFX = /^(นางสาว|น\.ส\.|นส\.|นาง|นาย)\s*/;
function splitPrefix(name) {
  const t = String(name == null ? '' : name).trim();
  const m = t.match(NAME_PFX);
  if (!m) return null;
  const rest = t.slice(m[0].length).trim();
  if (rest.length < 2 || !/^[ก-ฮเแโใไA-Za-z]/.test(rest)) return null;
  return { prefix: m[1], rest: rest };
}
function cleanRecordNames(r) {
  if (!r || typeof r !== 'object') return false;
  let changed = false;
  const rt = r.rtype || 'watch';
  if (rt === 'watch' || rt === 'vip') {
    const p = splitPrefix(r.fn);
    if (p) { r.fn = p.rest; if (!r.title) r.title = p.prefix; changed = true; }
  }
  ['persons', 'leaders', 'suspects', 'victims', 'deceased'].forEach((k) => {
    if (!Array.isArray(r[k])) return;
    r[k].forEach((x) => {
      if (!x || typeof x !== 'object') return;
      ['name', 'fn'].forEach((f) => {
        const p = splitPrefix(x[f]);
        if (p) { x[f] = p.rest; if (!x.title) x.title = p.prefix; changed = true; }
      });
    });
  });
  return changed;
}
(function cleanExistingNames() {
  let n = 0;
  records.forEach((r) => { if (cleanRecordNames(r)) n++; });
  if (!n) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (fs.existsSync(RECORDS_FILE)) fs.copyFileSync(RECORDS_FILE, path.join(DATA_DIR, 'backup-before-name-cleanup-' + ts + '.json'));
  } catch (e) { /* ignore */ }
  saveRecords();
  audit('clean_names', 'system', 'ตัดคำนำหน้าชื่อออกจากช่องชื่อ ' + n + ' รายการ', null);
  console.log('  ตัดคำนำหน้าชื่อออกจากช่องชื่อ ' + n + ' รายการ (สำรองไฟล์เดิมไว้แล้ว)');
})();

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
// จังหวัด หรือ โต๊ะข่าว (โต๊ะข่าวไม่ต้องขึ้นต้นด้วย จ.)
function provLabel(p) { p = String(p || '').trim(); if (!p) return ''; return p.indexOf('โต๊ะข่าว') === 0 ? p : 'จ.' + p; }
function newUser(username, password, name, prov, role, status) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: 'u' + crypto.randomBytes(8).toString('hex'),
    username: String(username).trim(),
    name: String(name || '').trim(),
    prov: String(prov || '').trim(),
    role: role,           // 'admin' | 'desk_head' (หัวหน้าโต๊ะข่าว กก.) | 'prov_head' (หน.ส.จว.) | 'officer'
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
  return { id: u.id, username: u.username, name: u.name, prov: u.prov, role: u.role, reqRole: u.reqRole || '', status: u.status, createdAt: u.createdAt };
}

// สร้าง admin คนแรกจาก environment variable — ถ้ามีบัญชีนี้อยู่แล้วจะ "รีเซ็ตรหัสผ่าน" ให้แทน
// (ใช้กู้คืนกรณี admin ลืมรหัสผ่าน: หยุด service แล้วรัน ADMIN_USER=... ADMIN_PASS=รหัสใหม่ node server.js หนึ่งครั้ง)
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  const existing = findUser(process.env.ADMIN_USER);
  if (!existing) {
    users.push(newUser(process.env.ADMIN_USER, process.env.ADMIN_PASS, 'ผู้ดูแลระบบ', '', 'admin', 'approved'));
    saveUsers();
    console.log('สร้างบัญชี admin แล้ว: ' + process.env.ADMIN_USER);
  } else {
    existing.salt = crypto.randomBytes(16).toString('hex');
    existing.hash = hashPassword(process.env.ADMIN_PASS, existing.salt);
    existing.role = 'admin';
    existing.status = 'approved';
    saveUsers();
    audit('reset_password', existing.username, 'รีเซ็ตรหัสผ่านผ่าน ADMIN_PASS ที่หน้าเซิร์ฟเวอร์', null);
    console.log('รีเซ็ตรหัสผ่านของบัญชี ' + existing.username + ' ตามค่า ADMIN_PASS แล้ว');
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
      // ตำแหน่งที่เลือกตอนสมัคร: "หน.ส.จว.<จังหวัด>" / "หัวหน้าโต๊ะข่าว กก." → เก็บเป็นสิทธิ์ที่ขอ (reqRole) รอแอดมินอนุมัติ สิทธิ์จริงยังเป็นเจ้าหน้าที่
      let prov = String(d.prov || '').trim(), reqRole = 'officer';
      if (prov.indexOf('หน.ส.จว.') === 0) { reqRole = 'prov_head'; prov = prov.slice('หน.ส.จว.'.length).trim(); }
      else if (prov.indexOf('หัวหน้าโต๊ะข่าว') === 0) { reqRole = 'desk_head'; prov = ''; }
      const u = newUser(username, password, d.name, prov, 'officer', 'pending');
      u.reqRole = reqRole;
      users.push(u); saveUsers();
      audit('register', username, 'สมัครสมาชิก (' + (u.name || '') + (u.prov ? ' ' + provLabel(u.prov) : '') + (reqRole !== 'officer' ? ' ขอสิทธิ์ ' + reqRole : '') + ') — รออนุมัติ', req);
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

    if (req.method === 'POST' && url.pathname === '/api/password') {
      const d = JSON.parse(await readBody(req) || '{}');
      const okOld = crypto.timingSafeEqual(Buffer.from(me.hash, 'hex'), Buffer.from(hashPassword(d.oldPassword || '', me.salt), 'hex'));
      if (!okOld) {
        audit('change_password_failed', me.username, 'รหัสผ่านเดิมไม่ถูกต้อง', req);
        sendJSON(res, 400, { ok: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' }); return;
      }
      const np = String(d.newPassword || '');
      if (np.length < 6) { sendJSON(res, 400, { ok: false, error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' }); return; }
      me.salt = crypto.randomBytes(16).toString('hex');
      me.hash = hashPassword(np, me.salt);
      saveUsers();
      // ตัด session อื่น ๆ ของผู้ใช้นี้ทิ้ง (เครื่องอื่นต้อง login ใหม่ด้วยรหัสใหม่) คงไว้เฉพาะเครื่องที่กดเปลี่ยน
      Object.keys(sessions).forEach((k) => { if (sessions[k].userId === me.id && k !== sess.sid) delete sessions[k]; });
      saveSessions();
      audit('change_password', me.username, 'เปลี่ยนรหัสผ่าน', req);
      sendJSON(res, 200, { ok: true }); return;
    }

    if (req.method === 'GET' && url.pathname === '/api/records') {
      sendJSON(res, 200, { ok: true, records: records.filter((r) => visibleTo(me, r)).map((r) => viewOf(me, r)) }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/records') {
      const data = JSON.parse(await readBody(req) || '{}');
      const incoming = Array.isArray(data.records) ? data.records : [];
      let added = 0, updated = 0, skipped = 0, pending = 0, pendingEdit = 0;
      const idx = new Map();
      records.forEach((r, i) => { if (r && r._id) idx.set(r._id, i); });
      const now = new Date().toISOString();
      incoming.forEach((r) => {
        if (!r || typeof r !== 'object') return;
        cleanRecordNames(r);
        const id = r._id ? String(r._id) : '';
        if (id && idx.has(id)) {
          const ex = records[idx.get(id)];
          // นับเฉพาะรายการที่เนื้อหาเปลี่ยนจริง (ไม่นับช่องสถานะ/การยืนยันที่เซิร์ฟเวอร์เป็นผู้กำหนด)
          const changed = JSON.stringify(stripMeta(ex)) !== JSON.stringify(stripMeta(r));
          if (!changed) return;
          const st = ex._status || 'verified';
          if (canVerifyRec(me, ex)) {            // ผู้ตรวจ/แอดมิน แก้ได้ตรง ๆ (สถานะคงเดิม)
            copyMeta(ex, r); records[idx.get(id)] = r; updated++;
          } else if (ex._createdBy === me.username && st !== 'verified') {   // เจ้าของแก้ฉบับที่ยังไม่ยืนยัน → ส่งใหม่เข้าคิว
            copyMeta(ex, r); r._status = 'pending'; delete r._return; records[idx.get(id)] = r; updated++; pending++;
          } else if (st === 'verified' && !ex._edit) {   // แก้ไขข้อมูลที่ยืนยันแล้ว → เก็บเป็นฉบับแก้ไขรอยืนยัน ของเดิมยังใช้ต่อ
            ex._edit = { by: me.username, at: now, data: stripMeta(r) }; pendingEdit++;
          } else skipped++;   // มีฉบับแก้ไขค้างอยู่แล้ว / ไม่มีสิทธิ์
        } else {
          r._createdBy = r._createdBy || me.username;
          r._createdAt = now;
          if (canVerifyRec(me, r)) { r._status = 'verified'; r._verifiedBy = me.username; r._verifiedAt = now; }
          else { r._status = 'pending'; delete r._verifiedBy; delete r._verifiedAt; pending++; }
          delete r._edit; delete r._return;
          records.push(r);
          if (id) idx.set(id, records.length - 1);
          added++;
        }
      });
      if (added || updated || pendingEdit) saveRecords();
      if (added || updated || skipped || pendingEdit) audit('save_records', me.username, 'เพิ่ม ' + added + ' / แก้ไข ' + updated + (pending ? ' / รอยืนยัน ' + pending : '') + (pendingEdit ? ' / ฉบับแก้ไขรอยืนยัน ' + pendingEdit : '') + (skipped ? ' / ข้าม ' + skipped : ''), req);
      sendJSON(res, 200, { ok: true, added: added, updated: updated, skipped: skipped, pending: pending, pendingEdit: pendingEdit, total: records.length }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/records/verify') {
      const d = JSON.parse(await readBody(req) || '{}');
      const r = records.find((x) => x && x._id === String(d.id || ''));
      if (!r) { sendJSON(res, 404, { ok: false, error: 'ไม่พบรายการ' }); return; }
      if (!canVerifyRec(me, r)) { sendJSON(res, 403, { ok: false, error: 'ไม่มีสิทธิ์ยืนยันข้อมูลรายการนี้ (' + (me.role === 'prov_head' ? 'ยืนยันได้เฉพาะจังหวัด ' + (me.prov || '-') : 'ผู้ตรวจยืนยันเท่านั้น') + ')' }); return; }
      const now = new Date().toISOString(); const note = String(d.note || '').slice(0, 500); const label = recLabel(r) + ' (' + (r.pv || '-') + ')';
      if (d.action === 'verify') {
        let what = 'ยืนยันข้อมูล';
        if (r._edit) { const base = stripMeta(r); const data = r._edit.data || {}; Object.keys(base).forEach((k) => { if (k[0] !== '_' && !(k in data)) delete r[k]; }); Object.keys(data).forEach((k) => { if (k[0] !== '_') r[k] = data[k]; }); what = 'ยืนยันฉบับแก้ไขของ ' + r._edit.by; delete r._edit; }
        r._status = 'verified'; r._verifiedBy = me.username; r._verifiedAt = now; delete r._return;
        saveRecords(); audit('verify_record', me.username, what + ': ' + label, req);
        sendJSON(res, 200, { ok: true, record: r }); return;
      }
      if (d.action === 'return') {
        if (!note) { sendJSON(res, 400, { ok: false, error: 'กรุณาระบุเหตุผลที่ส่งกลับ' }); return; }
        let what;
        if (r._edit) { what = 'ส่งกลับฉบับแก้ไขของ ' + r._edit.by; r._return = { by: me.username, at: now, note: note, what: 'edit', to: r._edit.by }; delete r._edit; }
        else { what = 'ส่งกลับให้แก้ไข'; r._status = 'returned'; r._return = { by: me.username, at: now, note: note, what: 'record', to: r._createdBy || '' }; }
        saveRecords(); audit('return_record', me.username, what + ': ' + label + ' — ' + note, req);
        sendJSON(res, 200, { ok: true, record: r }); return;
      }
      sendJSON(res, 400, { ok: false, error: 'action ไม่ถูกต้อง' }); return;
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

    // ----- ทะเบียนบุคคลกลาง: ผลการยืนยัน (ทุกคนอ่านได้ / admin เท่านั้นที่บันทึก) -----
    if (req.method === 'GET' && url.pathname === '/api/links') {
      sendJSON(res, 200, { ok: true, links: links }); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/links') {
      if (!(isAdmin || me.role === 'desk_head')) { sendJSON(res, 403, { ok: false, error: 'หัวหน้าโต๊ะข่าว กก. หรือ admin เท่านั้นที่ยืนยันข้อมูลบุคคลได้' }); return; }
      const data = JSON.parse(await readBody(req) || '{}');
      const items = Array.isArray(data.items) ? data.items : [];
      let n = 0;
      items.forEach((it) => {
        const a = String((it && it.a) || '').slice(0, 300), b = String((it && it.b) || '').slice(0, 300);
        const d = String((it && it.d) || '');
        if (!a || !b || a === b || ['same', 'diff', 'clear'].indexOf(d) < 0) return;
        const k1 = a < b ? a : b, k2 = a < b ? b : a;
        links = links.filter((x) => !(x.a === k1 && x.b === k2));
        if (d !== 'clear') links.push({ a: k1, b: k2, d: d, by: me.username, at: new Date().toISOString() });
        n++;
      });
      if (n) saveLinks();
      audit('confirm_person', me.username, String(data.note || '').slice(0, 200) + ' (' + n + ' คู่)', req);
      sendJSON(res, 200, { ok: true, saved: n, links: links }); return;
    }

    // ----- admin เท่านั้น -----
    if (url.pathname === '/api/users' || url.pathname === '/api/users/approve' || url.pathname === '/api/users/reject' || url.pathname === '/api/users/resetpw' || url.pathname === '/api/users/update' || url.pathname === '/api/audit') {
      if (!isAdmin) { sendJSON(res, 403, { ok: false, error: 'admin เท่านั้น' }); return; }
    }

    if (req.method === 'POST' && url.pathname === '/api/users/update') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = users.find((x) => x.id === d.id);
      if (!u) { sendJSON(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' }); return; }
      const name = String(d.name == null ? u.name : d.name).trim().slice(0, 120);
      const prov = String(d.prov == null ? u.prov : d.prov).trim().slice(0, 60);
      const role = (d.role && ROLES.indexOf(d.role) >= 0) ? d.role : u.role;
      if (!name) { sendJSON(res, 400, { ok: false, error: 'กรุณากรอกชื่อ-สกุล' }); return; }
      if (u.id === me.id && role !== 'admin') { sendJSON(res, 400, { ok: false, error: 'ลดสิทธิ์บัญชีตัวเองไม่ได้' }); return; }
      const before = (u.name || '') + ' / ' + (provLabel(u.prov) || '-') + ' / ' + u.role;
      u.name = name; u.prov = prov; u.role = role;
      saveUsers();
      audit('admin_update_user', me.username, 'แก้ไขข้อมูลผู้ใช้ ' + u.username + ': ' + before + ' → ' + name + ' / ' + (provLabel(prov) || '-') + ' / ' + role, req);
      sendJSON(res, 200, { ok: true, user: publicUser(u) }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/resetpw') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = users.find((x) => x.id === d.id);
      if (!u) { sendJSON(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' }); return; }
      const np = String(d.newPassword || '');
      if (np.length < 6) { sendJSON(res, 400, { ok: false, error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' }); return; }
      u.salt = crypto.randomBytes(16).toString('hex');
      u.hash = hashPassword(np, u.salt);
      saveUsers();
      Object.keys(sessions).forEach((k) => { if (sessions[k].userId === u.id) delete sessions[k]; });
      saveSessions();
      audit('admin_reset_password', me.username, 'ตั้งรหัสผ่านใหม่ให้ ' + u.username, req);
      sendJSON(res, 200, { ok: true }); return;
    }

    if (req.method === 'GET' && url.pathname === '/api/users') {
      sendJSON(res, 200, { ok: true, users: users.map(publicUser) }); return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/approve') {
      const d = JSON.parse(await readBody(req) || '{}');
      const u = users.find((x) => x.id === d.id);
      if (!u) { sendJSON(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' }); return; }
      u.status = 'approved';
      if (ROLES.indexOf(d.role) >= 0) u.role = d.role;
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
  console.log('SB1 Server พร้อมใช้งาน');
  console.log('  หน้าเว็บ:  http://' + (HOST === '0.0.0.0' ? '<server-ip>' : HOST) + ':' + PORT + '/');
  console.log('  ข้อมูล:    ' + RECORDS_FILE + ' (ตอนนี้ ' + records.length + ' รายการ)');
  console.log('  ผู้ใช้:    ' + users.length + ' บัญชี (admin: ' + users.filter((u) => u.role === 'admin').length + ')');
  if (!users.some((u) => u.role === 'admin')) {
    console.log('  ⚠ ยังไม่มี admin — รันด้วย ADMIN_USER=admin ADMIN_PASS=รหัสผ่าน node server.js เพื่อสร้าง');
  }
});
