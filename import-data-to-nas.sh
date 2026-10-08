#!/bin/bash
# ==========================================================================
# นำไฟล์ข้อมูลที่รวมเสร็จแล้วขึ้น NAS ด้วยคำสั่งเดียว — รันบน Mac:   ./import-data-to-nas.sh
#
# ใช้ไฟล์ใน ~/Downloads:  records-new.json (ต้องมี)  links-new.json, audit-*.log (ถ้ามี)
# ทำให้อัตโนมัติ: ส่งไป NAS → สำรองของเดิม → ติดตั้ง → รีสตาร์ท → แสดงจำนวนรายการ
# (ถามรหัส NAS 2 ครั้ง + รหัส sudo 1 ครั้ง เหมือน deploy-to-nas.sh)
# ==========================================================================
set -e
NAS="${NAS:-Chuey5910@100.86.87.94}"
DATA="/volume1/docker/sb1/data"
APP="/volume1/docker/sb1/app"
cd "${1:-$HOME/Downloads}"
[ -f records-new.json ] || { echo "✗ ไม่พบ records-new.json ใน Downloads"; exit 1; }
N="$(node -e "console.log(JSON.parse(require('fs').readFileSync('records-new.json','utf8')).records.length)")"
FILES="records-new.json"; [ -f links-new.json ] && FILES="$FILES links-new.json"
for f in audit-*.log; do [ -f "$f" ] && FILES="$FILES $f"; done
echo "== 1/2 ส่งไฟล์ไป NAS ($FILES = $N รายการ) — ใส่รหัส NAS ครั้งที่ 1 =="
COPYFILE_DISABLE=1 tar -czf - $FILES 2>/dev/null | ssh "$NAS" "rm -rf /tmp/sb1-import && mkdir -p /tmp/sb1-import && tar -xzf - -C /tmp/sb1-import 2>/dev/null"

echo "== 2/2 ติดตั้ง + รีสตาร์ท — ใส่รหัส NAS ครั้งที่ 2 แล้วรหัส sudo =="
ssh -t "$NAS" "sudo sh -c '
set -e; S=/tmp/sb1-import; T=\$(date +%Y%m%d-%H%M); mkdir -p $DATA/backups
cp $DATA/records.json $DATA/backups/records-before-import-\$T.json
[ -f $DATA/links.json ] && cp $DATA/links.json $DATA/backups/links-before-import-\$T.json
cp \$S/records-new.json $DATA/records.json
[ -f \$S/links-new.json ] && cp \$S/links-new.json $DATA/links.json
for a in \$S/audit-*.log; do [ -f \"\$a\" ] && cat \"\$a\" >> $DATA/audit.log; done
chown 1000:1000 $DATA/records.json $DATA/links.json 2>/dev/null || true
rm -rf \$S; cd $APP && docker compose restart >/dev/null 2>&1; sleep 3
docker compose logs --tail 5 | grep -o \"ตอนนี้ [0-9]* รายการ\" | tail -1
'"
echo "✓ เสร็จ — บรรทัดบนต้องเป็น \"ตอนนี้ $N รายการ\" แล้วเปิด http://${NAS#*@}:8081/ กด Cmd+Shift+R"
