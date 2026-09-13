#!/bin/sh
# ==========================================================================
# สำรองข้อมูล SB1 (โฟลเดอร์ data/) เป็นไฟล์ .tar.gz ลงวันที่
#
# ใช้:  ./backup-data.sh                         เก็บไว้ที่ ./backups
#       ./backup-data.sh /volume1/backup/sb1     เก็บไว้ที่อื่น (เช่นดิสก์/โฟลเดอร์สำรองบน NAS)
#
# ตั้งให้ทำอัตโนมัติทุกวันบน NAS (UGOS Pro):
#   Control Panel → Task Scheduler → สร้าง Scheduled Task แบบ Run command
#   คำสั่ง:  sh /volume1/docker/sb1/backup-data.sh /volume1/backup/sb1
#
# เก็บย้อนหลังกี่วัน (ลบไฟล์เก่ากว่านี้อัตโนมัติ)
KEEP_DAYS="${KEEP_DAYS:-30}"
# ==========================================================================
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/data"
DEST="${1:-$DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEST/sb1-data-$STAMP.tar.gz"

[ -d "$SRC" ] || { echo "✗ ไม่พบโฟลเดอร์ข้อมูล: $SRC"; exit 1; }
mkdir -p "$DEST"

tar -czf "$OUT" -C "$DIR" data
SIZE="$(du -h "$OUT" | cut -f1)"
echo "✓ สำรองข้อมูลแล้ว: $OUT ($SIZE)"

# ลบไฟล์สำรองที่เก่ากว่า KEEP_DAYS วัน
find "$DEST" -name 'sb1-data-*.tar.gz' -type f -mtime "+$KEEP_DAYS" -exec rm -f {} \; 2>/dev/null || true
COUNT="$(find "$DEST" -name 'sb1-data-*.tar.gz' -type f | wc -l | tr -d ' ')"
echo "  เก็บไฟล์สำรองย้อนหลัง $KEEP_DAYS วัน (ขณะนี้มี $COUNT ไฟล์ใน $DEST)"
