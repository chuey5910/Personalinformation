#!/bin/bash
# ==========================================================================
# กู้ข้อมูลหลังเผลอส่งไฟล์ records-new.json เก่าขึ้น NAS — รันบน Mac:   ~/Personalinformation/tools/recover-import.sh
#
# 1) ดึงจาก NAS (ใส่รหัส NAS 1 ครั้ง): ไฟล์สำรองก่อนนำเข้าครั้งล่าสุด + ข้อมูลปัจจุบัน
# 2) รวมบน Mac: ใช้ฉบับที่อัปเดตล่าสุดของแต่ละรายการ กู้รายการที่หายไป เก็บรายการที่เพิ่มใหม่
# 3) ได้ ~/Downloads/records-nas.json (ใช้รันสคริปต์นำเข้าต่อ) และ records-new.json (ส่งขึ้น NAS ด้วย ./import-data-to-nas.sh)
# ไม่แก้อะไรบน NAS — ตรวจผลก่อน แล้วค่อยส่งขึ้นเอง
# ==========================================================================
set -e
NAS="${NAS:-Chuey5910@100.86.87.94}"
DATA="/volume1/docker/sb1/data"
HERE="$(cd "$(dirname "$0")" && pwd)"
DL="$HOME/Downloads"; W="$DL/sb1-recover"
rm -rf "$W"; mkdir -p "$W"
echo "== ดึงไฟล์สำรองล่าสุด + ข้อมูลปัจจุบันจาก NAS — ใส่รหัส NAS =="
ssh "$NAS" "cd $DATA && B=\$(ls -t backups/records-before-import-*.json | head -1) && L=\$(echo \$B | sed 's/records-before/links-before/') && echo \"สำรองที่ใช้: \$B\" >&2 && tar -czf - records.json links.json \$B \$( [ -f \$L ] && echo \$L )" | tar -xzf - -C "$W"
RB="$(ls "$W"/backups/records-before-import-*.json)"; LB="$(ls "$W"/backups/links-before-import-*.json 2>/dev/null || true)"
rm -f "$DL"/records-new.json "$DL"/links-new.json "$DL"/audit-*.log
node "$HERE/recover-merge.js" "$RB" "$W/records.json" "${LB:-/dev/null}" "$W/links.json" "$DL"
rm -rf "$W"
echo "✓ เสร็จ (ยังไม่ได้ส่งขึ้น NAS) — แคปผลด้านบนส่งให้ตรวจก่อน"
