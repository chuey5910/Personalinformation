#!/bin/sh
# ==========================================================================
# สำรองข้อมูล SB1 (โฟลเดอร์ data/) เป็นไฟล์ .tar.gz ลงวันที่
#
# รองรับทั้ง 2 โครงสร้าง:
#   NAS  : /volume1/docker/sb1/{app,data,secrets}   → ใช้ ../data อัตโนมัติ
#   เครื่องเดี่ยว: <repo>/data                        → ใช้ ./data อัตโนมัติ
#
# ใช้:  ./backup-data.sh                        เก็บไว้ใน <data>/backups
#       ./backup-data.sh /volume1/backup/sb1    เก็บไว้ที่อื่น (แนะนำ: คนละดิสก์/นอก NAS)
#       DATA_DIR=/path/to/data ./backup-data.sh ระบุโฟลเดอร์ข้อมูลเอง
#
# ตั้งให้ทำอัตโนมัติทุกวันบน NAS (UGOS Pro):
#   Control Panel → Task Scheduler → Scheduled Task แบบ Run command
#   sh /volume1/docker/sb1/app/backup-data.sh /volume1/backup/sb1
#
KEEP_DAYS="${KEEP_DAYS:-30}"   # เก็บย้อนหลังกี่วัน (ลบไฟล์เก่ากว่านี้อัตโนมัติ)
# ==========================================================================
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# หาโฟลเดอร์ข้อมูล: ตามลำดับ DATA_DIR → ../data (โครงสร้าง NAS) → ./data
if [ -n "$DATA_DIR" ]; then SRC="$DATA_DIR"
elif [ -d "$DIR/../data" ]; then SRC="$(cd "$DIR/../data" && pwd)"
else SRC="$DIR/data"; fi

[ -d "$SRC" ] || { echo "✗ ไม่พบโฟลเดอร์ข้อมูล: $SRC"; exit 1; }

DEST="${1:-$SRC/backups}"
PARENT="$(dirname "$SRC")"
BASE="$(basename "$SRC")"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEST/sb1-data-$STAMP.tar.gz"

mkdir -p "$DEST"

# ไม่เอาโฟลเดอร์ backups เข้าไปในไฟล์สำรอง (กันไฟล์บวมทบไปเรื่อย ๆ)
tar -czf "$OUT" -C "$PARENT" --exclude="$BASE/backups" "$BASE"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "✓ สำรองข้อมูลแล้ว: $OUT ($SIZE)"
echo "  ข้อมูลต้นทาง: $SRC"

# ลบไฟล์สำรองที่เก่ากว่า KEEP_DAYS วัน
find "$DEST" -name 'sb1-data-*.tar.gz' -type f -mtime "+$KEEP_DAYS" -exec rm -f {} \; 2>/dev/null || true
COUNT="$(find "$DEST" -name 'sb1-data-*.tar.gz' -type f | wc -l | tr -d ' ')"
echo "  เก็บย้อนหลัง $KEEP_DAYS วัน (ขณะนี้มี $COUNT ไฟล์ใน $DEST)"
