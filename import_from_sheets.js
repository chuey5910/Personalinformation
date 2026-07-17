#!/usr/bin/env node
/**
 * สคริปต์ย้ายข้อมูลเก่าจาก Google Sheets (Apps Script) เข้า CHUEY-Server — ใช้ครั้งเดียวตอนย้ายระบบ
 *
 * ใช้: node import_from_sheets.js <URL /exec ของ Apps Script เดิม> [URL CHUEY-Server] [token]
 * เช่น: node import_from_sheets.js "https://script.google.com/macros/s/xxxx/exec" "http://127.0.0.1:8080"
 *
 * ถ้าไม่ระบุ URL เซิร์ฟเวอร์ จะใช้ http://127.0.0.1:8080 (รัน server.js ไว้ก่อน)
 */
'use strict';

const sheetUrl = process.argv[2];
const serverUrl = (process.argv[3] || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const token = process.argv[4] || '';

if (!sheetUrl) {
  console.error('ใช้: node import_from_sheets.js <URL /exec ของ Apps Script เดิม> [URL CHUEY-Server] [token]');
  process.exit(1);
}

(async () => {
  console.log('ดึงข้อมูลจาก Google Sheets:', sheetUrl);
  const res = await fetch(sheetUrl);
  const j = await res.json();
  const records = (j && j.records) || [];
  console.log('ได้ ' + records.length + ' รายการ');
  if (!records.length) { console.log('ไม่มีข้อมูลให้ย้าย'); return; }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-api-token'] = token;
  const res2 = await fetch(serverUrl + '/api/records', { method: 'POST', headers, body: JSON.stringify({ records }) });
  const j2 = await res2.json();
  if (!j2 || j2.ok !== true) throw new Error('ส่งเข้าเซิร์ฟเวอร์ไม่สำเร็จ: ' + JSON.stringify(j2));
  console.log('สำเร็จ — เพิ่ม ' + j2.added + ' / อัปเดต ' + j2.updated + ' รายการ (รวมบนเซิร์ฟเวอร์ ' + j2.total + ')');
})().catch((e) => { console.error('ล้มเหลว:', e.message || e); process.exit(1); });
