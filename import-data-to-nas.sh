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
# กันส่งไฟล์เก่า: records-new.json ต้องสร้างหลังจากดึง records-nas.json ครั้งล่าสุด (ถ้าเก่ากว่า = ไฟล์ค้างจากรอบก่อน สคริปต์รอบนี้ไม่ได้รัน)
if [ -f records-nas.json ] && [ records-nas.json -nt records-new.json ]; then
  echo "✗ หยุด: records-new.json เก่ากว่า records-nas.json ที่ดึงล่าสุด — สคริปต์นำเข้ารอบนี้ยังไม่ได้รัน (หรือรันไม่สำเร็จ) ไม่ส่งไฟล์เก่าขึ้น NAS"; exit 1
fi
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
docker compose logs --tail 8 | grep -o -E \"สร้างทะเบียนบุคคลอัตโนมัติ [0-9]+ รายการ|ตอนนี้ [0-9]+ รายการ\" | tail -2
'"
# ส่งแล้วลบไฟล์ที่ส่งออกจาก Downloads กันส่งซ้ำ/ส่งไฟล์เก่ารอบหน้า (audit log ถูกต่อท้ายบน NAS แล้ว)
rm -f records-new.json links-new.json audit-*.log
echo "✓ เสร็จ — บรรทัดบนต้องเป็น \"ตอนนี้ $N รายการ\" (ถ้ามีบรรทัด \"สร้างทะเบียนบุคคลอัตโนมัติ X รายการ\" ตัวเลขจะมากกว่า $N เท่ากับ X) แล้วเปิด http://${NAS#*@}:8081/ กด Cmd+Shift+R"
