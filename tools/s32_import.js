// ===== ตรวจ + นำเข้า (s32): มาตรการช่วยเหลือ ต.มหาวัน อ.แม่สอด (รายงาน สภ.แม่สอด 9 พ.ย.69) + ฐานสแกมเมอร์ใกล้ บก.DKBA ตรงข้าม บ.มอเกอไทย อ.พบพระ =====
// ใช้: cd ~/Downloads && node ~/Personalinformation/tools/s32_import.js   (อ่าน records-nas.json → เขียน records-new.json)
// ไม่มีข้อมูลส่วนบุคคล · กติกา: รายการที่มีอยู่ → เติม/ต่อท้ายเฉพาะที่ยังไม่มี (ไม่ทับ) / ไม่มี → สร้างใหม่
const fs = require('fs'); const crypto = require('crypto');
const SRC1 = 'แบบรายงานเหตุน่าสนใจ สภ.แม่สอด ลว. 9 พ.ย.2569 (การช่วยเหลือประชาชนที่ได้รับผลกระทบจากภัยสู้รบในประเทศเมียนมา)';
const SRC2 = 'โพสต์ข่าว "ฐานสแกมเมอร์ขยายเข้าพื้นที่ใกล้กองบัญชาการ DKBA ตรงข้ามบ้านมอเกอไทย จังหวัดตาก" พร้อมภาพถ่ายทางอากาศ (©NAPHAT KONGCHAN) — ไม่ระบุวันที่ถ่าย';
const AID = 'การช่วยเหลือของภาครัฐ (' + SRC1 + '): จากการสู้รบช่วงปลาย ต.ค.–ต้น พ.ย.69 บริเวณ อ.เมียวดี แรงระเบิดและสะเก็ดระเบิดข้ามมาสร้างความเสียหายต่ออาคารบ้านเรือนและสถานที่ราชการฝั่งไทย'
  + ' · ผู้ว่าราชการจังหวัดตากประกาศให้ ม.1 บ้านมหาวัน, ม.2 บ้านใหม่แม่โกนเกน, ม.4 บ้านแม่โกนเกน และ ม.9 บ้านห้วยมหาวงศ์ ต.มหาวัน อ.แม่สอด เป็นพื้นที่ภัยพิบัติ จัดงบประมาณช่วยเหลือ 1,000,000 บาท'
  + ' · หลักเกณฑ์: 1) บ้านเรือนเสียหาย รายละไม่เกิน 88,600 บาท (เสียหายไม่มากจ่ายตามจริง) 2) ผู้บาดเจ็บรักษาตัวเกิน 3 วัน เยียวยารายละ 5,000 บาท 3) หากมีการอพยพ ค่าน้ำ ค่าอาหาร จ่ายตามจริง'
  + ' · ที่ว่าการอำเภอแม่สอดสร้างหลุมหลบภัย 10 หลุม (ม.1 จำนวน 2, ม.2 จำนวน 2, ม.4 จำนวน 2, ม.9 จำนวน 4) · ทหาร ฝ่ายปกครอง และตำรวจ ออกตรวจตามแนวชายแดนตลอด 24 ชั่วโมง'
  + ' · จังหวัดตากจะดำเนินการทดลองจ่ายเงินเยียวยาช่วยเหลือในทันทีเมื่อได้รับงบประมาณ';
const TNC = 'แหล่งอาชญากรรมข้ามชาติ (ฝั่งตรงข้าม)';
const SITE = { pl_name: 'ฐานสแกมเมอร์แห่งใหม่ใกล้ บก.DKBA (ตรงข้าม บ.มอเกอไทย)', pl_country: 'เมียนมา', pl_opp: 'ฝั่งเมียนมา ไม่ไกลจากพื้นที่ตั้งกองบัญชาการกองกำลังกะเหรี่ยงประชาธิปไตย (DKBA)',
  pl_thSide: 'ตรงข้าม บ.มอเกอไทย อ.พบพระ จ.ตาก', pl_status: 'ระหว่างก่อตั้ง', pl_threat: 'สแกมเมอร์ / แก๊งคอลเซ็นเตอร์ (ย้ายฐาน)',
  pl_buildings: 'ภาพถ่ายทางอากาศเห็นสิ่งปลูกสร้างและพื้นที่ที่มีลักษณะเป็นโครงการก่อสร้างขนาดใหญ่ (อาคารหลังคาขาว/ฟ้าหลายกลุ่ม ถนนดินเชื่อมหลายจุด)',
  pl_history: 'พบข้อมูลว่าขบวนการสแกมเมอร์กำลังทยอยย้ายฐานปฏิบัติการเข้าสู่พื้นที่บริเวณนี้มากขึ้น หลังการปราบปรามสแกมเซ็นเตอร์ในพื้นที่อื่น · ที่มา: ' + SRC2,
  pl_trend: 'การปราบปรามในพื้นที่หนึ่งอาจเป็นเพียงการผลักให้เครือข่ายย้ายไปตั้งฐานในพื้นที่ใหม่ที่เข้าถึงและตรวจสอบได้ยากกว่าเดิม · อ.พบพระ อาจกลายเป็นจุดยุทธศาสตร์สำคัญของการขยายตัวของเครือข่ายสแกมเมอร์ตามแนวชายแดน โดยเฉพาะบริเวณที่มีเส้นทางขนส่งเชื่อมกับฝั่งไทย ซึ่งอาจเอื้อต่อการลำเลียงวัสดุก่อสร้าง อาหาร เชื้อเพลิง และสิ่งจำเป็น · ควรติดตามว่าใครอำนวยความสะดวกให้ดำเนินกิจการต่อ',
  pl_source: SRC2, pl_reliab: 'ข่าวสื่อ / ภาพถ่ายทางอากาศ (ยังไม่มีรายงานทางราชการยืนยัน)', pl_surveyDate: '2026-11-10' };
const cur = JSON.parse(fs.readFileSync('records-nas.json', 'utf8')); let records = cur.records || []; let links = [];
try { links = JSON.parse(fs.readFileSync('links-nas.json', 'utf8')).links || []; } catch (e) {}
const before = records.length; const now = new Date().toISOString(); const out = [];
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 12);
const active = (r) => r && !r._deleted && r._status !== 'returned';
const TX = (r) => JSON.stringify(Object.assign({}, r, { leaders: [], photo: '' }));
// 1) ชายแดนตาก 4 รายการ (7, 8, 21, 29 ต.ค.69)
out.push('===== 1) สถานการณ์ชายแดน จ.ตาก (ต.มหาวัน) — ต่อท้ายการช่วยเหลือของภาครัฐ =====');
['2026-10-07', '2026-10-08', '2026-10-21', '2026-10-29'].forEach((d) => {
  const rs = records.filter((r) => active(r) && r.rtype === 'border' && r.pv === 'ตาก' && r.bd_date === d && /มหาวัน/.test(TX(r)));
  if (!rs.length) { out.push('• ' + d + ': ⚠ ไม่พบรายการเดิม (ข้าม)'); return; }
  rs.forEach((r) => { if (String(r.bd_detail || '').indexOf(SRC1) >= 0) { out.push('• ' + d + ': มีข้อมูลนี้แล้ว'); return; }
    r.bd_detail = (r.bd_detail ? r.bd_detail + '\n' : '') + AID; r._updatedAt = now; out.push('• ' + d + ': ต่อท้ายข้อมูลการช่วยเหลือแล้ว'); }); });
// 2) ฐานสแกมเมอร์ตรงข้าม บ.มอเกอไทย
out.push('', '===== 2) แหล่งอาชญากรรมข้ามชาติ ตรงข้าม บ.มอเกอไทย อ.พบพระ =====');
let p = records.find((r) => active(r) && r.rtype === 'place' && /มอเกอไทย/.test(TX(r)));
const dkba = records.find((r) => active(r) && r.rtype === 'org' && r.org_status === 'กองกำลังต่างชาติ' && /^dkba|\(dkba\)/i.test(r.org_name || ''));
if (!p) { p = { _id: 'p32_' + md5(SITE.pl_name), rtype: 'place', pl_form: 'tnc', pv: 'ตาก', pl_type: TNC, pl_activity: 'สแกมเมอร์ / คอลเซ็นเตอร์', pl_forces: [], leaders: [], pl_moves: [],
    _status: 'verified', _verifiedBy: 'admin', _verifiedAt: now, _createdAt: now, _createdBy: 'admin' }; Object.assign(p, SITE); records.push(p); out.push('• ยังไม่มี → สร้างใหม่ "' + SITE.pl_name + '" (สถานะ: ระหว่างก่อตั้ง)'); }
else { let f = 0; Object.keys(SITE).forEach((k) => { if (!p[k]) { p[k] = SITE[k]; f++; } else if (['pl_history', 'pl_trend', 'pl_source'].indexOf(k) >= 0 && String(p[k]).indexOf(SITE[k].slice(0, 30)) < 0) { p[k] += ' · ' + SITE[k]; f++; } });
  out.push('• มีอยู่แล้ว "' + p.pl_name + '" → เติม/ต่อท้าย ' + f + ' ช่อง'); }
p.pl_forces = Array.isArray(p.pl_forces) ? p.pl_forces : []; if (dkba && p.pl_forces.indexOf(dkba._id) < 0) { p.pl_forces.push(dkba._id); out.push('  ผูกกองกำลัง: ' + dkba.org_name); } else if (!dkba) out.push('  (ไม่พบกลุ่มกองกำลัง DKBA ในระบบ — ไม่ได้ผูก)');
p.pl_moves = Array.isArray(p.pl_moves) ? p.pl_moves : []; if (!p.pl_moves.some((m) => String(m.detail || '').indexOf('ภาพถ่ายทางอากาศ') >= 0)) p.pl_moves.push({ mdate: '', detail: 'ภาพถ่ายทางอากาศพบสิ่งปลูกสร้าง/โครงการก่อสร้างขนาดใหญ่ ขบวนการสแกมเมอร์ทยอยย้ายฐานเข้าพื้นที่ (ไม่ระบุวันที่ถ่าย)' });
p._updatedAt = now;
fs.writeFileSync('records-new.json', JSON.stringify({ updatedAt: now, records })); fs.writeFileSync('links-new.json', JSON.stringify({ updatedAt: now, links }));
fs.writeFileSync('audit-s32.log', JSON.stringify({ time: now, action: 'import_s32', user: 'admin', detail: out.join(' / '), ip: '' }) + '\n');
console.log(['ก่อน ' + before + ' รายการ', ''].concat(out).concat(['', 'หลัง ' + records.length + ' รายการ → เขียน records-new.json แล้ว (ยังไม่ได้ส่งขึ้น NAS)']).join('\n'));
