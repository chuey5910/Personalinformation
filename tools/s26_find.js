// ===== ตรวจข้อมูลในระบบก่อนนำเข้า: แหล่งสแกมเมอร์ฝั่งตรงข้าม จ.ตาก + บุคคล + กองกำลัง (รายงาน 26 พ.ค.69 / 21 ส.ค.69) =====
// ใช้: cd ~/Downloads && node ~/Personalinformation/tools/s26_find.js   (อ่านอย่างเดียว ไม่แก้ข้อมูล · อ่าน records-nas.json ในโฟลเดอร์ปัจจุบัน)
const fs = require('fs');
const R = (JSON.parse(fs.readFileSync('records-nas.json', 'utf8')).records || []).filter((r) => r && !r._deleted);
const T = (r) => JSON.stringify(r).replace(/"data:[^"]*"/g, '""').toLowerCase();
const nm = (r) => { const t = r.rtype || 'watch'; if (t === 'place') return '[แหล่ง/สถานที่] ' + (r.pl_name || '-') + ' · ' + (r.pl_type || '') + ' · จ.' + (r.pv || '-');
  if (t === 'org') return '[กลุ่ม/องค์กร] ' + (r.org_name || '-') + ' · ' + (r.org_status || '') + ' · จ.' + (r.pv || '-');
  if (t === 'watch' || t === 'vip' || t === 'bgcheck') return '[บุคคล ' + t + (r.grp ? ' กลุ่ม ' + r.grp : '') + '] ' + [r.title, r.fn, r.ln].filter(Boolean).join(' ') + (r.alias ? ' (ชื่ออื่น: ' + r.alias + ')' : '') + ' · จ.' + (r.pv || '-') + (r.photo ? ' · มีรูป' : '');
  return '[' + t + '] ' + (r.ev_name || r.act_name || r.nw_title || r.case_subject || r.bd_loc || r.veh_plate || '-') + ' · จ.' + (r.pv || '-'); };
const Q = [
  ['แหล่ง', 'ชเวโก๊กโก่', ['ชเวโก๊กโก่', 'ชเวโกกโก่', 'ชเวโก๊กโก', 'shwe kokko', 'shwekokko']],
  ['แหล่ง', 'เมืองใหม่หวันหยา', ['หวันหยา', 'หวั่นหยา', 'huanya']],
  ['แหล่ง', 'เมืองผาลู', ['ผาลู', 'pha lu', 'phalu']],
  ['แหล่ง', 'ไท่ฉาง 1 / ไท่ฉาง 2 / เคลอะโกรทะ', ['ไท่ฉาง', 'ไทฉาง', 'เจาะแคท', 'เคลอะโกร', 'สตาร์ซิตี้', 'star city', 'tai chang', 'taichang']],
  ['แหล่ง', 'อุกู่ทะ / Deko Park', ['อุกู่ทะ', 'อุกูทะ', 'อุกะเทระ', 'deko', 'เดโก']],
  ['แหล่ง', 'พื้นที่ตรงข้าม อ.ท่าสองยาง (กุมมะหนี่ / กะนูทะ / จอเกทะ / กะแต / ตาเล)', ['กุมมะหนี่', 'ตะลอซอ', 'กะนูทะ', 'จอเกทะ', 'kyaw kay hta', 'กะแต', 'ตาเล', 'ห้วยปางยาง']],
  ['แหล่ง', 'War Mee Hta (วามีทะ)', ['วามีทะ', 'war mee']],
  ['แหล่ง', 'แต ผิว ชอง ต่อง / ห้วยทรายขาว', ['แต ผิว', 'แตผิว', 'ห้วยทรายขาว', 'กอกะเร็ก']],
  ['แหล่ง', 'ตรงข้าม บ.หมื่นฤาชัย', ['หมื่นฤาชัย']],
  ['แหล่ง', 'Koe Ma Nee / Mae La Park / Bella Park', ['koe ma nee', 'mae la park', 'bella park', 'โกมะนี', 'แม่หละ พาร์ค', 'แม่หละพาร์ค']],
  ['แหล่ง', 'KK Park', ['kk park', 'เคเค พาร์ค', 'เคเคพาร์ค']],
  ['บุคคล', 'หม่องชิตตู่ / Saw Chit Thu', ['ชิตตู่', 'ชิต ตู', 'chit thu', 'ชิดตู่']],
  ['บุคคล', 'พ.อ.เต่งวิน', ['เต่งวิน', 'เต่ง วิน', 'tin win']],
  ['บุคคล', 'เซอ เจ้อเจียง / She Zhejiang', ['เจ้อเจียง', 'zhejiang', 'เชอ จื้อเจียง', 'ซีจื้อเจียง']],
  ['บุคคล', 'พ.อ.โรเจอร์ขิ่น', ['โรเจอร์', 'roger']],
  ['บุคคล', 'พ.อ.นะเลอเฮ / ไหน่หล่วย', ['นะเลอเฮ', 'ไหน่หล่วย']],
  ['บุคคล', 'พล.จ.ไซจ่อละ (โกไซ)', ['ไซจ่อละ', 'โกไซ', 'sai kyaw']],
  ['บุคคล', 'พล.อ.หม่องเส่ยวะ', ['หม่องเส่ยวะ', 'เส่ยวะ']],
  ['บุคคล', 'นายอาเหลียง', ['อาเหลียง']],
  ['บุคคล', 'Boss Li / Mr. LAM KA LOK', ['boss li', 'lam ka']],
  ['บุคคล', 'พ.ท.หม่องวิน / พ.ท.ซอจ่อมิต / พ.ต.เตอกว่าดี / พ.ท.หยั่วเก่ / พ.ต.จ่อเว', ['หม่องวิน', 'ซอจ่อมิต', 'กะโดง', 'เตอกว่าดี', 'หยั่วเก่', 'จ่อเว']],
  ['กองกำลัง/กลุ่มทุน', 'BGF / KNA', ['bgf', 'kna', 'กะเหรี่ยงพิทักษ์', 'พิทักษ์ชายแดน']],
  ['กองกำลัง/กลุ่มทุน', 'KNU', ['knu', 'สหภาพแห่งชาติกะเหรี่ยง']],
  ['กองกำลัง/กลุ่มทุน', 'DKBA', ['dkba', 'โกล้ทูบอ', 'พุทธประชาธิปไตย']],
  ['กองกำลัง/กลุ่มทุน', 'Yatai IHG / Huanya Group / เฮงเซ็ง', ['yatai', 'หยาไถ่', 'หยาไท่', 'ยาไต่', 'huanya inter', 'เฮงเซ็ง']],
];
const out = ['ข้อมูลทั้งหมด ' + R.length + ' รายการ', ''];
let cat = '';
Q.forEach(([c, label, ks]) => {
  if (c !== cat) { out.push('===== ' + c + ' ====='); cat = c; }
  const hit = R.filter((r) => { const t = T(r); return ks.some((k) => t.includes(k.toLowerCase())); });
  const main = hit.filter((r) => ['place', 'org', 'watch', 'vip', 'bgcheck', undefined].indexOf(r.rtype) >= 0);
  const other = hit.length - main.length;
  out.push('• ' + label + ': ' + (main.length ? 'พบ ' + main.length : 'ไม่พบ') + (other ? ' (+ปรากฏในข่าว/คดี/กิจกรรมอื่น ' + other + ' รายการ)' : ''));
  main.slice(0, 8).forEach((r) => out.push('    - ' + nm(r)));
  if (main.length > 8) out.push('    … อีก ' + (main.length - 8) + ' รายการ');
});
const fo = R.filter((r) => r.rtype === 'org' && r.org_status === 'กองกำลังต่างชาติ');
out.push('', '===== กลุ่ม/องค์กร สถานะ "กองกำลังต่างชาติ" ทั้งหมด (' + fo.length + ') =====');
fo.forEach((r) => out.push('    - ' + (r.org_name || '-') + ' · จ.' + (r.pv || '-')));
const tnc = R.filter((r) => r.rtype === 'place' && r.pl_type === 'แหล่งอาชญากรรมข้ามชาติ (ฝั่งตรงข้าม)' && (r.pv === 'ตาก'));
out.push('', '===== แหล่งอาชญากรรมข้ามชาติ (ฝั่งตรงข้าม) จ.ตาก ที่มีอยู่ทั้งหมด (' + tnc.length + ') =====');
tnc.forEach((r) => out.push('    - ' + (r.pl_name || '-') + ' · ' + (r.pl_opp || '') + ' · ' + (r.pl_status || '')));
fs.writeFileSync('s26_find.txt', out.join('\n') + '\n');
console.log(out.join('\n')); console.log('\n→ บันทึกผลไว้ที่ s26_find.txt แล้ว');
