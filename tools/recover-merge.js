// กู้ข้อมูลหลังนำเข้าไฟล์เก่าทับ: รวม "สำรองก่อนนำเข้าครั้งล่าสุด" (backup) กับ "ข้อมูลปัจจุบันบน NAS" (current)
// ใช้: node recover-merge.js <records-backup> <records-current> <links-backup> <links-current> <โฟลเดอร์ผลลัพธ์>
// กติกา: id ที่มีทั้งสองฝั่ง → ใช้ฉบับที่อัปเดตล่าสุด · มีเฉพาะใน backup → กู้คืน · มีเฉพาะใน current → เก็บไว้ (เพิ่มใหม่หลังนำเข้า)
// ผลลัพธ์: records-nas.json + links-nas.json (ใช้เป็นข้อมูลตั้งต้นของสคริปต์นำเข้า) และ records-new.json + links-new.json (ส่งขึ้น NAS ได้ทันที)
const fs = require('fs'); const path = require('path');
const [rb, rc, lb, lc, outDir] = process.argv.slice(2);
const load = (f, k) => { try { return JSON.parse(fs.readFileSync(f, 'utf8'))[k] || []; } catch (e) { return []; } };
const ts = (r) => [r && r._updatedAt, r && r._verifiedAt, r && r._createdAt, r && r._edit && r._edit.at, r && r._return && r._return.at].filter(Boolean).sort().pop() || '';
const B = load(rb, 'records'), C = load(rc, 'records');
if (!B.length) { console.log('✗ อ่านไฟล์สำรองไม่ได้ หรือไม่มีข้อมูล: ' + rb); process.exit(1); }
const cMap = new Map(C.filter((r) => r && r._id).map((r) => [r._id, r])); const seen = new Set();
const out = []; let restored = 0, newer = 0, same = 0; const rtypes = {};
B.forEach((r) => { if (!r || !r._id) { out.push(r); return; } seen.add(r._id); const c = cMap.get(r._id);
  if (!c) { out.push(r); restored++; const t = r.rtype || 'watch'; rtypes[t] = (rtypes[t] || 0) + 1; return; }
  if (ts(c) > ts(r)) { out.push(c); newer++; } else { out.push(r); same++; } });
let added = 0; C.forEach((r) => { if (r && r._id && !seen.has(r._id)) { out.push(r); added++; } });
const LB = load(lb, 'links'), LC = load(lc, 'links'); const lm = new Map();
LB.concat(LC).forEach((x) => { if (!x || !x.a || !x.b) return; const k = x.a + '|' + x.b; const o = lm.get(k); if (!o || String(x.at || '') > String(o.at || '')) lm.set(k, x); });
const links = Array.from(lm.values()); const now = new Date().toISOString();
['records-nas.json', 'records-new.json'].forEach((f) => fs.writeFileSync(path.join(outDir, f), JSON.stringify({ updatedAt: now, records: out })));
['links-nas.json', 'links-new.json'].forEach((f) => fs.writeFileSync(path.join(outDir, f), JSON.stringify({ updatedAt: now, links })));
const TL = { watch: 'บุคคลเฝ้าระวัง', vip: 'บุคคลสำคัญ', bgcheck: 'ตรวจสอบประวัติ', place: 'สถานที่', case: 'คดี', activity: 'กิจกรรมตามวงรอบ', event: 'การจัดกิจกรรม', org: 'กลุ่ม/องค์กร', vehicle: 'ยานพาหนะ', border: 'ชายแดน', news: 'รายงานข่าว' };
console.log(['สำรองก่อนนำเข้า: ' + B.length + ' รายการ · ปัจจุบันบน NAS: ' + C.length + ' รายการ',
  '• กู้คืนรายการที่หายไป: ' + restored + (restored ? ' (' + Object.keys(rtypes).map((t) => (TL[t] || t) + ' ' + rtypes[t]).join(', ') + ')' : ''),
  '• ใช้ฉบับใหม่กว่าจาก NAS ปัจจุบัน: ' + newer + ' · ใช้ฉบับจากสำรอง: ' + same,
  '• รายการใหม่ที่เพิ่มหลังนำเข้า (เก็บไว้): ' + added,
  '• การยืนยันคนเดียวกัน/คนละคน: ' + links.length + ' รายการ (สำรอง ' + LB.length + ' · ปัจจุบัน ' + LC.length + ')',
  'รวมหลังกู้: ' + out.length + ' รายการ → เขียน records-nas.json / records-new.json แล้ว'].join('\n'));
