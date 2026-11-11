// ===== ตรวจ + นำเข้า (s33): สถานการณ์การสู้รบ ด้านตรงข้าม อ.พบพระ จว.ตาก 11 พ.ย.69 (รายงาน ฉก.ราชมนู) =====
// ใช้: cd ~/Downloads && node ~/Personalinformation/tools/s33_import.js   (อ่าน records-nas.json → เขียน records-new.json)
// ไม่มีข้อมูลส่วนบุคคล · มีรายการวันเดียวกันในพื้นที่เดียวกันแล้ว → เติมเฉพาะช่องว่าง / ไม่มี → สร้างใหม่
const fs = require('fs'); const crypto = require('crypto');
const SRC = 'รายงานข่าวสารความเคลื่อนไหวสถานการณ์การสู้รบ ด้านตรงข้าม อ.พบพระ จว.ตาก — ฉก.ราชมนู (11 พ.ย.69)';
const B = { pv: 'ตาก', bd_date: '2026-11-11', bd_time: '05.30 น.', bd_cat: 'สถานการณ์ชายแดน',
  bd_loc: 'พื้นที่ระหว่างสันเขาตะนะอึ๊คี (MU 543220) – แนวเขาตะนะอึ๊คี (MU 537209) – (MU 550198) บ.เมี๊ยะตาหย่า อ.เมียวดี จ.เมียวดี รัฐกะเหรี่ยง สมม.',
  bd_opposite: 'ตรงข้าม บ.ขุนห้วยช่องแคบ ม.3 ต.ช่องแคบ อ.พบพระ จ.ตาก', bd_distance: '5', bd_coord: 'จุดตกระเบิด MU 543220 / MU 537209 / MU 550198 · จุดยิง ฐานฯ ซอแทงโกง MU 517266',
  bd_attacker: 'ทมม.พัน.ป.402 ฐานฯ ซอแทงโกง (MU 517266) ร่วมกับ ทมม.บก.ควบคุมยุทธการที่ 13 และ กกล.DKBA กลุ่ม DKBO', bd_defender: 'กกล.กลุ่มต่อต้านฯ',
  bd_combat_note: 'ยิง อวน. และใช้อากาศยานไร้คนขับ (โดรน/โดรนพลีชีพ FPV) ทิ้งระเบิดเป็นระยะๆ', bd_impact_th: 'ไม่มี', bd_dmg_mm: 'ไม่ทราบผลการสูญเสีย',
  bd_detail: 'เมื่อ 11 พ.ย.69 เวลาประมาณ 05.30 น. ทมม.พัน.ป.402 ฐานฯ ซอแทงโกง (MU 517266) ร่วมกับ ทมม.บก.ควบคุมยุทธการที่ 13 และ กกล.DKBA กลุ่ม DKBO ได้ทำการยิง อวน. และใช้อากาศยานไร้คนขับ (โดรน/โดรนพลีชีพ FPV) ทิ้งระเบิดเป็นระยะๆ โจมตี กกล.กลุ่มต่อต้านฯ บริเวณพื้นที่ระหว่างสันเขาตะนะอึ๊คี (MU 543220) – แนวเขาตะนะอึ๊คี (MU 537209) – (MU 550198) บ.เมี๊ยะตาหย่า อ.เมียวดี จ.เมียวดี รัฐกะเหรี่ยง สมม. ด้านตรงข้ามฝั่งไทย บ.ขุนห้วยช่องแคบ ม.3 ต.ช่องแคบ อ.พบพระ จว.ตาก ห่างจากแนวชายแดนประมาณ 5 กม. ไม่ทราบผลการสูญเสีย และไม่มีผลกระทบต่อฝั่งไทย · หน่วยจะติดตามความเคลื่อนไหวและรายงานให้ทราบต่อไป · ที่มา: ' + SRC };
const COMBAT = ['ปืนใหญ่/เครื่องยิงลูกระเบิด (Artillery strike)', 'โดรน (Military Drone)'];
const cur = JSON.parse(fs.readFileSync('records-nas.json', 'utf8')); let records = cur.records || []; let links = [];
try { links = JSON.parse(fs.readFileSync('links-nas.json', 'utf8')).links || []; } catch (e) {}
const before = records.length; const now = new Date().toISOString(); const out = [];
const active = (r) => r && !r._deleted && r._status !== 'returned';
const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const ORG = {}; [['mm', /กองทัพเมียนมา|ทัพเมียนมา|tatmadaw|^sac\b/i], ['dkba', /^dkba|\(dkba\)/i]].forEach(([k, re]) => { const o = records.find((r) => active(r) && r.rtype === 'org' && r.org_status === 'กองกำลังต่างชาติ' && re.test(r.org_name || '')); if (o) ORG[k] = o; });
let r = records.find((z) => active(z) && z.rtype === 'border' && z.pv === 'ตาก' && z.bd_date === B.bd_date && /เมี๊?ยะตาหย่า|ช่องแคบ|ซอแทงโกง/.test(JSON.stringify(z)));
if (!r) { r = { _id: 'b33_' + crypto.createHash('md5').update('pbp-20261111').digest('hex').slice(0, 12), rtype: 'border', bd_persons: [], bd_forces: [], _status: 'verified', _verifiedBy: 'admin', _verifiedAt: now, _createdAt: now, _createdBy: 'admin' }; records.push(r); out.push('• 11 พ.ย.69 ตรงข้าม อ.พบพระ (บ.เมี๊ยะตาหย่า): ยังไม่มี → สร้างใหม่'); }
else out.push('• 11 พ.ย.69 ตรงข้าม อ.พบพระ: มีอยู่แล้ว → เติมช่องว่าง');
let f = 0; Object.keys(B).forEach((k) => { if (empty(r[k])) { r[k] = B[k]; f++; } });
const cb = String(r.bd_combat || '').split(/\s*,\s*/).filter(Boolean); COMBAT.forEach((c) => { if (cb.indexOf(c) < 0) { cb.push(c); f++; } }); r.bd_combat = cb.join(', ');
r.bd_forces = Array.isArray(r.bd_forces) ? r.bd_forces : []; ['mm', 'dkba'].forEach((k) => { if (ORG[k] && r.bd_forces.indexOf(ORG[k]._id) < 0) { r.bd_forces.push(ORG[k]._id); f++; } });
r._updatedAt = now; out.push('  เติม ' + f + ' ช่อง · ผูกกองกำลัง: ' + (['mm', 'dkba'].filter((k) => ORG[k]).map((k) => ORG[k].org_name).join(', ') || '-'));
fs.writeFileSync('records-new.json', JSON.stringify({ updatedAt: now, records })); fs.writeFileSync('links-new.json', JSON.stringify({ updatedAt: now, links }));
fs.writeFileSync('audit-s33.log', JSON.stringify({ time: now, action: 'import_s33', user: 'admin', detail: out.join(' / '), ip: '' }) + '\n');
console.log(['ก่อน ' + before + ' รายการ', '', '===== สถานการณ์ชายแดน จ.ตาก ====='].concat(out).concat(['', 'หลัง ' + records.length + ' รายการ → เขียน records-new.json แล้ว (ยังไม่ได้ส่งขึ้น NAS)']).join('\n'));
