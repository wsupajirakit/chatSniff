# คำสั่งและโหมดทั้งหมด — us-stock-fund-manager

## ① เรียกใช้สกิล (3 โหมด)

### Mode A — Single-Stock Thesis

**Trigger:** พิมพ์ ticker / "วิเคราะห์ NVDA" / "AMD ควรซื้อไหม" / ขอ trade plan  
**ได้อะไร:** Macro→Micro, FA, TA, News, entry/stop/target, conviction 1–10  
**ข้อมูล:** web search หาสด (ไม่ต้องแนบไฟล์)  
**Timeframe option:** day/swing/position/long-term (ระบุเพิ่มเติมได้)

### Mode B — Macro Cascade

**Trigger:** ข่าว macro / ตัวเลขเศรษฐกิจ / "เหตุการณ์นี้กระทบตลาดยังไง"  
**ได้อะไร:** Layer 1–6 (narrative → asset impact → portfolio impact → watchlist → action plan → hidden opportunities) + rating 1–5 ดาว  
**ข้อมูล:** web search หาสด

### Mode C — CSV/UIPT Screen

**Trigger:** วางไฟล์ CSV ใน `csv/` → ขอ "UIPT" / "Core Radar" / "screen"  
**ได้อะไร:** Regime, sector flow, UIPT staging, rankings S/M, entry zones, portfolio actions  
**ไฟล์ต้องมี:** `ztrade_formula*.csv` + `ztrade_export_{1w,1d,4h,1h}_part{1,2}.csv`  
**Horizon option:** `UIPT-S xD` (default 3D) / `UIPT-M xW` (default 4W) — x กำหนดเอง

## UIPT-S UIPT-M

## ② คำสั่ง run.sh (Mode C)

**Path:** `.claude/skills/us-stock-fund-manager/scripts/run.sh`

### Auto (ค่าเดิม)

```bash
run.sh
```

**ทำอะไร:** csv ใหม่ → คำนวณ + บันทึก history / csv เดิม → ใช้ผลเก่า ไม่คำนวณ  
**เมื่อไหร่:** ใช้เป็นหลักทุกครั้ง  
**ประหยัด:** มากกว่า `--force` (content-hash จับซ้ำเอง)

### --digest

```bash
run.sh --digest
```

**ทำอะไร:** อ่าน digest ล่าสุดจาก history **ไม่คำนวณเลย**  
**เมื่อไหร่:** อยากดูผลเดิมเร็ว / ไม่มี csv ใหม่

### --compare

```bash
run.sh --compare              # เทียบ 2 snapshot ล่าสุด
run.sh --compare snap1 snap2  # เทียบ 2 snapshot ที่ระบุ
```

**ทำอะไร:** แสดงตาราง: stage เปลี่ยน / kill list เพิ่ม-หลุด / 1D CMF พลิก / ราคาเขยับ  
**เมื่อไหร่:** หลังได้ csv ชุดใหม่ อยากรู้ "อะไรเปลี่ยน"

### --force

```bash
run.sh --force
```

**ทำอะไร:** บังคับคำนวณใหม่ csv เดิม **เก็บประวัติไว้ (history ไม่ลบ)**  
**เมื่อไหร่:** สงสัยผลเดิม / library เพิ่งแก้บั๊ก  
**ตัวอย่าง:** "ทำการบ้านใหม่ แต่เก็บสมุดทำการบ้านวันไหม่"

### --force-mode

```bash
run.sh --force-mode
```

**ทำอะไร:** ลบ history ทั้งหมดก่อน **แล้วคำนวณใหม่จาก csv ล่าสุด**  
**เมื่อไหร่:** อยากเริ่มต้นใหม่หมด / ไม่อยากเห็นประวัติเก่า  
**ตัวอย่าง:** "ทำการบ้านใหม่ + ขว้างสมุดเก่าทั้งหมด"

### --clean-csv

```bash
run.sh --clean-csv
```

**ทำอะไร:** ลบไฟล์ csv ซ้ำ (เก็บไฟล์ใหม่สุดต่อ tf/part)  
**เมื่อไหร่:** โฟลเดอร์ csv รก มีไฟล์ `(4)(5)(6)` เยอะ

### --clean-history

```bash
run.sh --clean-history 10    # เก็บ 10 อันล่าสุด ลบที่เหลือ
run.sh --clean-history 0     # ลบหมด
```

**ทำอะไร:** ตัด snapshot เก่า เก็บแค่ N อันล่าสุด  
**เมื่อไหร่:** history โตเกิน

### --csv-dir, --port, --history

```bash
run.sh --csv-dir X --port Y --history Z
```

**ทำอะไร:** เปลี่ยน path จาก default (`csv/`, `my_port.md`, `history/`)  
**เมื่อไหร่:** ย้ายที่เก็บไฟล์

---

## ③ วิธีบอกผมภาษาธรรมชาติ (ที่เรามี mapping เอง)

ไม่ต้องจำคำสั่ง — บอกได้แบบนี้:

| ที่บอก                    | Map เป็น             | อธิบาย                   |
| ------------------------- | -------------------- | ------------------------ |
| "force-mode" / "เทพใหม่"  | `--force-mode`       | ลบประวัติ ทำใหม่จากศูนย์ |
| "อ่านผลเดิม" / "ไม่คำนวณ" | `--digest`           | ใช้ history ไม่ทำใหม่    |
| "เทียบกับรอบก่อน"         | `--compare`          | แสดง diff stage/kill/CMF |
| "ทำใหม่แต่เก็บประวัติ"    | `--force`            | สงสัยผลเดิม              |
| "เคลียร์ csv ซ้ำ"         | `--clean-csv`        | ลบไฟล์ซ้ำ เก็บใหม่สุด    |
| "ตัดประวัติ"              | `--clean-history 10` | เก็บ 10 snapshot ล่าสุด  |

---

## ④ สิ่งที่ pipeline คำนวณให้ (ไม่ต้องคิด)

### 4-Phase UIPT

| Phase | ชื่อ                          | ดูอะไร                                                                                      |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| P1    | Core Engine                   | IPI = CMF×100 + RVOL_dev×0.5 + OBV_slope×50                                                 |
| P2    | Macro Filter (⛔ Kill Switch) | 1W+1D Golden Cross + 1W CMF>0 + 1W IPI=Accum; **ถ้า 1W/1D เป็น Distribution ลง KILL ทันที** |
| P3    | Setup Window                  | 1D/4H: ย่อ EMA20/50 + RSI 40–60 + 1D CMF>0                                                  |
| P4    | Sniper Trigger                | 1H: ยืนเหนือ VWAP + RVOL>50% + OBV ขึ้น + IPI=Accum (RTH สด)                                |

### Stage ที่ได้ต่อหุ้น

| Stage                     | หมายถึง                                |
| ------------------------- | -------------------------------------- |
| `KILL`                    | ห้ามแตะ (1D หรือ 1W เป็น Distribution) |
| `FAIL`                    | ไม่ผ่านโครงสร้าง                       |
| `WATCH(loose)`            | GC ครบแต่ 1W IPI แค่ Neutral           |
| `MACRO-WATCH`             | ผ่าน Phase 2 เต็ม (รอ P3/P4)           |
| `SETUP`                   | ผ่าน P2+P3 สแตนด์บาย (รอ 1H ยิง)       |
| `TRIGGER`                 | ครบ 4 phase ยิงได้ (ทีซ)               |
| `SETUP(loose)` / `COILED` | เงื่อนไขแบบหลวม / กำลังจะระเบิด        |
| `EXTENDED`                | ขาขึ้นไปไกลแล้ว ห้ามไล่                |
| `NEAR-PIVOT`              | ใกล้ swing high ก่อนหน้า               |

### Horizon Mode

| Mode          | Horizon                  | น้ำหนัก | Trigger                             |
| ------------- | ------------------------ | ------- | ----------------------------------- |
| **UIPT-S xD** | 1–5 วัน (default 3D)     | 1H/4H   | Coil detector, NEAR-PIVOT, EXTENDED |
| **UIPT-M xW** | 1–8 สัปดาห์ (default 4W) | 1W/1D   | ต้องผ่าน P2 เต็ม                    |

### อื่น ๆ ที่รันให้

- **Layer-0 Regime:** VIX, US10Y→4.55, DXY→101.8/100.0, WTI→72, HYG, breadth → permission level (RISK-ON / SELECTIVE / TRANSITION / RISK-OFF)
- **Sector Flow Map:** เงินเข้า/ออก, RS vs SPY, 1H/4H/1D/1W CMF
- **Rule-6 Trap Detector:** แท่งแดงที่ CMF ยังบวก (ก่อนหน้า Accum + RVOL>1.2)
- **News×Flow Gate:** ข่าวดี + CMF ลบ = ขายใส่ (avoid)
- **Portfolio Marks:** ราคา, P&L, stage จากไฟล์ `my_port.md`

---

## ⑤ ส่วนที่ Claude ต้องคิดเอง (ไม่ใช่สคริปต์)

1. **Regime call สุดท้าย** — permission_hint เป็นแค่ suggestion / ผมตัดสิน RISK-ON/SELECTIVE/TRANSITION/RISK-OFF
2. **News horizon tagging** — ข่าว short/medium/long + decay rules
3. **Entry/Stop/Target narrative** — แปลตัวเลขเป็นแผนเข้า-ออก + R:R ratio
4. **Portfolio actions** — ตัดตำแหน่ง / เพิ่ม / ถือต่อ + share counts
5. **Hidden risk pick** — เสี่ยงที่ consensus มองข้าม (credit widening, yen-carry, etc.)
6. **Core Radar summary line** — สรุป 1 บรรทัด "Regime — Top Watchlist: X, Y, Z"

---

## ⑥ ไฟล์ต่อ Mode C

```
csv/
  ├─ ztrade_formula(N).csv          ← เลือกใหม่สุด
  ├─ ztrade_export_1w_part1(N).csv  ├─ 4 timeframe
  ├─ ztrade_export_1w_part2(N).csv  │  2 part แต่ละ
  ├─ ztrade_export_1d_part1(N).csv  │  ✓ N = version
  ├─ ztrade_export_1d_part2(N).csv  ├─ เลือกใหม่สุด
  ├─ ztrade_export_4h_part1(N).csv  │  ต่อ tf
  ├─ ztrade_export_4h_part2(N).csv  │
  ├─ ztrade_export_1h_part1(N).csv  │
  └─ ztrade_export_1h_part2(N).csv  ┘

my_port.md               ← portfolio เดียว (optional)
history/
  ├─ 202607071215_1565990c/
  │  ├─ digest.md       ← ตาราง + สรุป (input สำหรับรายงาน)
  │  ├─ full.json       ← ข้อมูลเต็มทั้งหมด (เทียบ --compare)
  │  └─ report.md       ← รายงานวันนั้น (ผมเขียนหลัง digest)
  ├─ 202607061215_xxxxx/
  └─ LATEST             ← pointer ไฟล์ snapshot ล่าสุด
```

---

## ⑦ Quick Reference — บอกอะไรเดี่ยว

| บอก                       | ตอบยังไง                                            |
| ------------------------- | --------------------------------------------------- |
| "วิเคราะห์ NVDA"          | Mode A: ดึง web search หา live data → thesis เต็ม   |
| "ข่าว Fed ขึ้นอัตราเพิ่ม" | Mode B: macro cascade → layer 1–6                   |
| csv ใหม่ → "screen"       | Mode C: run.sh auto → digest                        |
| csv เดิม → "screen"       | Mode C: run.sh auto (reuse history)                 |
| "force-mode"              | Mode C: run.sh --force-mode (ล้าง history + ทำใหม่) |
| "เทียบวันก่อน"            | Mode C: run.sh --compare                            |
| "ทำการบ้านใหม่"           | Mode C: run.sh --force (เก็บประวัติ)                |
