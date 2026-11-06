// ถอดรหัสสคริปต์นำเข้าที่มีข้อมูลส่วนบุคคล (เข้ารหัส AES-256-GCM เก็บใน tools/secure/) → เขียนลง ~/Downloads
// ใช้: node ~/Personalinformation/tools/decrypt.js <ชื่อไฟล์ เช่น s27> <รหัสผ่านที่ได้รับในแชต>
const fs = require('fs'); const path = require('path'); const os = require('os'); const crypto = require('crypto');
const [name, pass] = process.argv.slice(2);
if (!name || !pass) { console.log('ใช้: node decrypt.js <s27> <รหัสผ่าน>'); process.exit(1); }
const buf = fs.readFileSync(path.join(__dirname, 'secure', name + '.enc'));
const salt = buf.subarray(0, 16), iv = buf.subarray(16, 28), tag = buf.subarray(28, 44), data = buf.subarray(44);
const key = crypto.scryptSync(pass, salt, 32);
const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
let out; try { out = Buffer.concat([d.update(data), d.final()]); } catch (e) { console.log('✗ รหัสผ่านไม่ถูกต้อง'); process.exit(1); }
const dest = path.join(os.homedir(), 'Downloads', name + '_import.js'); fs.writeFileSync(dest, out);
console.log('✓ ได้ไฟล์ ' + dest + ' (มีข้อมูลส่วนบุคคล ห้ามส่งต่อ ลบทิ้งหลังใช้)');
