// ===== นำเอกสารในโฟลเดอร์ library/ เข้าเมนู "ห้องสมุด" บนเว็บ =====
// ใช้ (บน Mac):  cd ~/Downloads && node ~/Personalinformation/tools/import-library.js
//   ต้องมี records-nas.json (ดึงจาก NAS) ใน Downloads · ได้ records-new.json → ส่งขึ้นด้วย import-data-to-nas.sh
//   ต้อง deploy โค้ดที่มีเมนูห้องสมุดขึ้น NAS ก่อน (โค้ดเก่าไม่รู้จักเอกสารห้องสมุด)
// กติกา: เอกสารที่มีในเว็บแล้ว (รหัสเดียวกัน) ข้าม ไม่ทับ · บุคคลในเอกสาร เซิร์ฟเวอร์ผูกการ์ดเองตอนรีสตาร์ท
//   (หาการ์ดเดิมจากชื่อทุกจังหวัด ไม่มี → สร้างการ์ดบุคคลสำคัญ) — สคริปต์นี้แสดงผลที่คาดไว้ให้ตรวจก่อน
const fs = require('fs'); const path = require('path');
const LIB = path.join(__dirname, '..', 'library');
const cur = JSON.parse(fs.readFileSync('records-nas.json', 'utf8')); const records = cur.records || [];
const before = records.length; const now = new Date().toISOString(); const out = [];
const active = (r) => r && !r._deleted && r._status !== 'returned';
const nk = (s) => String(s || '').replace(/^(นางสาว|น\.ส\.|นาง|นาย)\s*/, '').replace(/\s+/g, '');
const have = new Set(records.map((r) => r && r._id));
const files = fs.readdirSync(LIB).filter((f) => /^lib-.*\.json$/.test(f)).sort();
let added = 0;
files.forEach((f) => {
  const d = JSON.parse(fs.readFileSync(path.join(LIB, f), 'utf8'));
  if (have.has(d.id)) { out.push('• ' + d.id + ' มีในเว็บแล้ว → ข้าม'); return; }
  const follow = (d.followUp || []).map((x) => 'ติดตาม' + (x.date ? ' (' + x.date + ')' : '') + ': ' + x.what).join('\n');
  const r = { _id: d.id, rtype: 'library', pv: d.pv || '', lib_title: d.title || '', lib_unit: d.unit || '', lib_docDate: d.docDate || '', lib_received: d.receivedAt || '',
    lib_cats: d.cats || [], lib_tags: d.tags || [], lib_content: d.content || '',
    lib_persons: (d.persons || []).map((p) => ({ title: p.title || '', name: p.name, position: p.position || '', vipCat: p.vipCat || 'polit' })),
    lib_others: (d.others || []).join('\n'), lib_files: [], lib_note: [d.note, follow].filter(Boolean).join('\n'),
    _status: 'verified', _verifiedBy: 'admin', _verifiedAt: now, _createdAt: now, _createdBy: 'admin' };
  records.push(r); added++;
  out.push('• ' + d.id + ' เพิ่มใหม่: ' + r.lib_title.slice(0, 70) + (r.lib_title.length > 70 ? '…' : ''));
  r.lib_persons.forEach((p) => {
    const hit = records.filter((x) => active(x) && ['watch', 'vip', 'bgcheck'].indexOf(x.rtype || 'watch') >= 0 && nk((x.fn || '') + (x.ln || '')) === nk(p.name));
    const best = hit.find((x) => x.rtype === 'vip') || hit[0];
    out.push('    👤 ' + (p.title ? p.title + ' ' : '') + p.name + ' → ' + (best ? 'ผูกการ์ดเดิม (' + (best.rtype === 'vip' ? 'บุคคลสำคัญ' : best.rtype === 'watch' ? 'กลุ่ม ' + best.grp : 'ตรวจสอบประวัติ') + ' จ.' + (best.pv || '-') + ')' + (hit.length > 1 ? ' ⚠ ชื่อนี้มี ' + hit.length + ' การ์ด' : '') : 'ยังไม่มี → เซิร์ฟเวอร์จะสร้างการ์ดบุคคลสำคัญ'));
  });
});
fs.writeFileSync('records-new.json', JSON.stringify({ updatedAt: now, records }));
fs.writeFileSync('audit-library.log', JSON.stringify({ time: now, action: 'import_library', user: 'admin', detail: 'นำเข้าเอกสารห้องสมุด ' + added + ' เอกสาร', ip: '' }) + '\n');
console.log(['ก่อน ' + before + ' รายการ', '', '===== ห้องสมุด (' + files.length + ' เอกสารในโฟลเดอร์ library/) ====='].concat(out).concat(['', 'เพิ่ม ' + added + ' เอกสาร · หลัง ' + records.length + ' รายการ → เขียน records-new.json แล้ว (ยังไม่ได้ส่งขึ้น NAS)']).join('\n'));
