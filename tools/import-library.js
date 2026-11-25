// ===== นำเอกสารในโฟลเดอร์ library/ เข้าเมนู "ห้องสมุด" บนเว็บ =====
// ใช้ (บน Mac):  cd ~/Downloads && node ~/Personalinformation/tools/import-library.js
//   ต้องมี records-nas.json (ดึงจาก NAS) ใน Downloads · ได้ records-new.json → ส่งขึ้นด้วย import-data-to-nas.sh
//   ต้อง deploy โค้ดที่มีเมนูห้องสมุดขึ้น NAS ก่อน (โค้ดเก่าไม่รู้จักเอกสารห้องสมุด)
// กติกา: เอกสารที่มีในเว็บแล้ว (รหัสเดียวกัน) ข้าม ไม่ทับ · บุคคลในเอกสาร เซิร์ฟเวอร์ผูกการ์ดเองตอนรีสตาร์ท
//   บุคคลในเอกสาร: ผูกเฉพาะการ์ดบุคคลสำคัญ (หาจากชื่อทุกจังหวัด) ไม่มี → สร้างการ์ดบุคคลสำคัญใหม่ในสคริปต์นี้ (ไม่ผูกการ์ดกลุ่มอื่น — ผู้ใช้เลือก)
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const CAT = { polit: 'นักการเมือง (สส./สว./รัฐมนตรี)', expolit: 'อดีตนักการเมือง', local: 'นักการเมืองท้องถิ่น (นายก อบจ./เทศมนตรี/อบต./สจ.)', exlocal: 'อดีตนักการเมืองท้องถิ่น', leader: 'ผู้นำท้องถิ่น (กำนัน/ผู้ใหญ่บ้าน)', force: 'ผู้นำกองกำลังต่างชาติ', envoy: 'ทูต', acad: 'นักวิชาการ', gov: 'ผู้บริหารภาครัฐ' };
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
    const vip = hit.find((x) => x.rtype === 'vip'); const other = hit.filter((x) => x.rtype !== 'vip');
    const nm = (p.title ? p.title + ' ' : '') + p.name; const note = other.length ? ' (ชื่อนี้มีการ์ดอื่นอีก ' + other.length + ' ใบ: ' + other.map((x) => (x.rtype === 'watch' ? 'กลุ่ม ' + x.grp : 'ตรวจสอบประวัติ') + ' จ.' + (x.pv || '-')).join(', ') + ' — รวมเองในหน้าตรวจสอบบุคคล)' : '';
    if (vip) { p.pref = vip._id; out.push('    👤 ' + nm + ' → ผูกการ์ดบุคคลสำคัญเดิม จ.' + (vip.pv || '-') + note); return; }
    const a = p.name.trim().split(/\s+/); const ck = CAT[p.vipCat] ? p.vipCat : 'polit';
    const w = { _id: 'vl_' + crypto.createHash('md5').update(nk(p.name)).digest('hex').slice(0, 12), rtype: 'vip', pv: '', title: p.title || '', fn: a[0], ln: a.slice(1).join(' '), nid: '', nick: '', alias: '', ph: '',
      addrReg: { house: '', moo: '', village: '', soi: '', road: '', prov: '', dist: '', subdist: '', zip: '' }, cats: [{ key: ck, label: CAT[ck], text: p.position || '' }],
      _autoFrom: r._id, _status: 'verified', _verifiedBy: 'admin', _verifiedAt: now, _createdAt: now, _createdBy: 'admin' };
    if (!records.some((x) => x && x._id === w._id)) records.push(w);
    p.pref = w._id; out.push('    👤 ' + nm + ' → สร้างการ์ดบุคคลสำคัญใหม่ (' + CAT[ck] + ': ' + (p.position || '-') + ')' + note);
  });
});
fs.writeFileSync('records-new.json', JSON.stringify({ updatedAt: now, records }));
fs.writeFileSync('audit-library.log', JSON.stringify({ time: now, action: 'import_library', user: 'admin', detail: 'นำเข้าเอกสารห้องสมุด ' + added + ' เอกสาร', ip: '' }) + '\n');
console.log(['ก่อน ' + before + ' รายการ', '', '===== ห้องสมุด (' + files.length + ' เอกสารในโฟลเดอร์ library/) ====='].concat(out).concat(['', 'เพิ่ม ' + added + ' เอกสาร · หลัง ' + records.length + ' รายการ → เขียน records-new.json แล้ว (ยังไม่ได้ส่งขึ้น NAS)']).join('\n'));
