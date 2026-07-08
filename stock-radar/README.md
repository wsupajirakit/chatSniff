# stock-radar

พื้นที่ทำงานของ skill `us-stock-fund-manager` (Mode C: CSV/UIPT screen)

```
csv/        ← วางไฟล์ ztrade_formula*.csv + ztrade_export_{1w,1d,4h,1h}_part{1,2}*.csv
my_port.md  ← พอร์ตปัจจุบัน (main + swing) — pipeline อ่านอัตโนมัติ
history/    ← ผลวิเคราะห์ทุกครั้ง: <asofET>_<fingerprint>/{digest.md, full.json, report.md}
.claude/skills/us-stock-fund-manager/scripts/  ← radar_lib.py (สูตรตายตัวทั้งหมด) + radar_run.py + run.sh
```

## ใช้งาน

```bash
.claude/skills/us-stock-fund-manager/scripts/run.sh                 # csv ใหม่ → คำนวณ+บันทึก | csv เดิม → ใช้ผลเก่า (ประหยัด token)
.claude/skills/us-stock-fund-manager/scripts/run.sh --digest        # อ่าน digest ล่าสุดจาก history (ไม่คำนวณ)
.claude/skills/us-stock-fund-manager/scripts/run.sh --compare       # เทียบ 2 snapshot ล่าสุด (stage/kill/CMF เปลี่ยนตรงไหน)
.claude/skills/us-stock-fund-manager/scripts/run.sh --force         # บังคับคำนวณใหม่ (history เดิมยังอยู่)
.claude/skills/us-stock-fund-manager/scripts/run.sh --force-mode    # ล้าง history ทั้งหมดก่อน แล้วคำนวณใหม่จาก csv ล่าสุด
.claude/skills/us-stock-fund-manager/scripts/run.sh --clean-csv     # ลบ csv ซ้ำ (เก็บไฟล์ใหม่สุดต่อ tf/part)
.claude/skills/us-stock-fund-manager/scripts/run.sh --clean-history 10  # เก็บ snapshot ล่าสุด 10 อัน ลบที่เหลือ
```

- ไฟล์ csv ซ้ำ (ชื่อ `(N)` ใหม่แต่เนื้อหาเดิม) → fingerprint แบบ content-hash จับได้เอง ไม่คำนวณซ้ำ
- ลบโฟลเดอร์ `history/` ทั้งอันได้ปลอดภัย — รันรอบหน้าสร้างใหม่เอง
- สิ่งที่สคริปต์คำนวณให้: sanity/tz-fix, IPI/CMF/RVOL (session ถูกต้อง), Kill Switch, UIPT staging, coil, levels, portfolio marks
- สิ่งที่ Claude ต้องคิดเอง: regime call + permission, news horizon×flow, แผน entry/stop/target, portfolio actions, hidden risk

## รายงานเก็บถาวร (รอด clean-all)
- ทุกครั้งวิเคราะห์เสร็จ: `run.sh --save-report <file>` → ได้ `history/reports/report_latest.md` (ใหม่เสมอ) + สำเนา stamp วันที่ `report_<YYYYMMDD_HHMM>_asof<...>.md`
- `history/reports/` **ไม่ถูกลบ**โดย clean-csv/clean-history/clean-all/force-mode — เทียบย้อนหลังได้เสมอ

## สำหรับ AI อื่น (Gemini / GPT) — skill-automate
- `skill-automate/radar <command>` = bash CLI เรียกใช้ pipeline เดียวกัน (ดู `skill-automate/radar help`)
- คู่มือ self-contained: [skill-automate/MANUAL.md](skill-automate/MANUAL.md) · entry สำหรับ Gemini: [GEMINI.md](GEMINI.md)
- **ห้ามแก้ไฟล์ใต้ `.claude/`** — wrapper เรียกใช้เฉย ๆ ไม่แตะ skill ของ Claude
