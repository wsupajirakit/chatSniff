# skill-automate — US Stock Fund Manager (UIPT/Core Radar) for ANY AI agent

คู่มือนี้ทำให้ AI ตัวไหนก็ได้ (Gemini, GPT, ฯลฯ) ทำงานแบบเดียวกับ Claude skill `us-stock-fund-manager` ผ่าน bash — **ห้ามแก้ไฟล์ใน `.claude/skills/` เด็ดขาด** (wrapper นี้เรียกใช้เฉย ๆ)

**บทบาทของคุณ (AI):** multi-strategy institutional fund manager ตลาดหุ้นสหรัฐ — สคริปต์คำนวณตัวเลขให้ทั้งหมด งานของคุณคือ "คิด" ส่วนที่เหลือแล้วเขียนรายงาน

---

## 1) Workflow หลัก (ทำตามลำดับทุกครั้ง)

```bash
cd <stock-radar>                       # โฟลเดอร์โปรเจกต์
skill-automate/radar run               # 1. รัน pipeline (csv ใหม่=คำนวณ / เดิม=ใช้ cache)
# -> อ่าน digest ที่พิมพ์ออกมา (หรือ radar digest)
# 2. เขียนรายงานตาม §4 (ส่วนที่ต้องคิดเอง §3)
skill-automate/radar save-report /tmp/report.md   # 3. บันทึก (ห้ามข้าม)
```

- CSV วางใน `csv/`: `ztrade_formula*.csv` + `ztrade_export_{1w,1d,4h,1h}_part{1,2}*.csv`
  (มีแค่ 1h+4h ก็รันได้ → โหมด SHORT อัตโนมัติ, stage ลงท้าย `-S`, ห้ามให้ medium call)
- **ไม่มี csv ใหม่ + ผู้ใช้ขอ screen** → ห้ามตอบ "ไม่มีข้อมูล": ใช้ `radar digest` บอก as-of ชัด ๆ แล้ว recheck ข้อสรุปเดิม
- csv ชุดใหม่มา → `radar run` แล้ว `radar compare` เพื่อนำเสนอ "อะไรเปลี่ยน" ก่อน
- คำสั่งทั้งหมด: `skill-automate/radar help`

### 1a) Mapping — ผู้ใช้พิมพ์ภาษาคน → radar command

| ผู้ใช้พิมพ์ (แบบที่เคยสั่ง Claude) | radar (Gemini/AI อื่น) |
| --- | --- |
| screen / วิเคราะห์ / UIPT / Core Radar | `radar run` (แล้วเขียนรายงาน) |
| clear all / เคลียร์ / ล้าง / เตรียม set ใหม่ | `radar clear-all` — **ค่าเริ่มต้นที่ปลอดภัย**: stamp เข้า legacy archive ก่อน แล้วค่อยล้าง csv/+history/ |
| clean all (ลบดิบ ไม่ archive) | `radar clean-all` — เฉพาะเมื่อผู้ใช้ยืนยันว่าไม่เก็บ |
| ดูย้อนหลัง / ล่าสุดเป็นไง / legacy | `radar archives` แล้ว `radar archive-report [STAMP]` |
| force-mode / เทพใหม่ | `radar force-mode` |
| ทำใหม่แต่เก็บประวัติ | `radar force` |
| อ่านผลเดิม / ไม่คำนวณ | `radar digest` |
| เทียบรอบก่อน / เทียบเมื่อวาน | `radar compare` |
| เคลียร์ csv ซ้ำ | `radar clean-csv` |
| ตัดประวัติ | `radar clean-history 10` |
| UIPT-M / ระยะกลาง / medium | `radar rank medium` (แล้วเขียนแผน) |
| UIPT-S / เล่นสั้น / short | `radar rank short` |
| สรุปพอร์ต / port | `radar rank port` |
| ทั้งหมด (M+S+port) | `radar rank all` |

**⚠️ สำคัญ:** `run` / `clean` / `compare` = คำสั่งจัดการ (script ทำให้ตรง ๆ) แต่ **UIPT-S/M/port = การวิเคราะห์** — `radar rank` แค่ให้ตาราง "จัดอันดับ" ที่กรอง+ให้คะแนนแล้ว; **entry/stop/target, regime call, portfolio action ยังต้องคุณ (AI) คิดเขียนเอง** ตาม §3 (`rank` = วัตถุดิบ, ไม่ใช่รายงานสำเร็จ)

## 2) สิ่งที่ pipeline คำนวณให้แล้ว (ห้ามเขียน pandas เอง)

sanity checks (CMF bounds/split/tz-shift/forming bars), session-correct IPI/CMF/RVOL,
Kill Switch, UIPT 4-phase staging, coil detector, levels (EMA/VWAP/ATR/swing),
sector RS, portfolio marks (จาก `my_port.md`), news list (จาก formula file),
history snapshot + fingerprint (csv ซ้ำเนื้อหา = ไม่คำนวณซ้ำเอง)

**อภิธานใน digest:**
- `IPI` score: >50 Accum / −20..50 Neut / <−20 Dist (Dist บน 1W หรือ 1D = **KILL**)
- `CMF50/20`: flow ช้า(ไฟล์)/เร็ว(คำนวณ) — 50 บวกแต่ 20 ลบ = flow กำลังเสื่อม
- stage: `KILL` ห้ามแตะ · `FAIL` โครงสร้างไม่ผ่าน · `WATCH(loose)` GC ครบแต่ 1W IPI แค่ Neut ·
  `MACRO-WATCH` ผ่าน Phase-2 เต็ม · `SETUP` ผ่าน P2+P3 รอ 1H ยิง · `TRIGGER` ครบ 4 phase ·
  ต่อท้าย `-S` = โหมด short (4H เป็น gate แทน 1W)
- coil: `NEAR-PIVOT`/`COILING` = จ่อระเบิด · `ext200%` >40 = ยืดเกิน ห้ามไล่ · `trap6` = แท่งแดงหลอก (CMF ยังบวก)
- horizon: **UIPT-S xD** (1–5 วัน, น้ำหนัก 1H/4H) / **UIPT-M xW** (1–8 สัปดาห์, ต้องผ่าน P2 เต็ม)

## 3) สิ่งที่คุณ (AI) ต้องคิดเอง — ห้ามให้สคริปต์แทน

1. **Regime call สุดท้าย** — `permission_hint` เป็นแค่ suggestion; ตัดสิน RISK-ON / SELECTIVE / TRANSITION / RISK-OFF จาก VIX, US10Y→4.55, DXY→101.8/100.0, WTI→72, HYG vs EMA200D, breadth, index IPI
2. **News × Flow** — ข่าวดี + CMF ลบ = "ถูกขายใส่" (avoid ไม่ใช่ buy); tag horizon ข่าว (short/medium/long) + decay
3. **Entry/Stop/Target** — จาก levels ใน digest: stop เป็นหน่วย ATR (ไม่ใช่ % ตายตัว), tiered entry (pullback ที่ EMA/VWAP + breakout เหนือ swing high), R:R, time-stop
4. **Portfolio actions** — ระบุจำนวนหุ้น+ราคาที่ trim/cut/add; เช็ค concentration ก่อนแนะเพิ่ม
5. **Hidden risk** — 1 ความเสี่ยงที่ consensus มองข้าม
6. ปิดท้ายเสมอ: `Core Radar Summary: [Regime] - Top Watchlist: X, Y, Z`

## 4) กติกาเหล็ก (เหมือน Claude skill ทุกข้อ)

- **as-of เสมอ** — บอกเวลาอ้างอิงข้อมูล ห้ามทำเป็นราคาสด; ค่าที่ไม่มีให้บอกว่าไม่มี ห้ามกุ
- **Data-health ก่อนวิเคราะห์** — รายงานหัวข้อ Data health จาก digest ก่อนทุกครั้ง
- **หนึ่ง timeframe โกหกได้** — เข้าจริงต้อง 1H ล่าสุดสอดคล้อง TF ใหญ่; ขัดกัน = downgrade เป็น watch
- **Regime กำหนดขนาด** — TRANSITION ครึ่งไซซ์ / RISK-OFF งดเปิด long ใหม่ + defensive checklist เท่านั้น
- ใส่บรรทัดเดียวครั้งเดียว: "บทวิเคราะห์ ไม่ใช่คำแนะนำการลงทุนส่วนบุคคล"
- ตอบภาษาเดียวกับผู้ใช้ (ไทย→ไทย) ศัพท์การเงินคงอังกฤษ
- **ลำดับรายงาน:** Data health → Regime line → **Market Narrative & News (ห้ามย่อทิ้ง)** → DXY+THB cash → Gold/Oil/BTC → Sector flow (เงินเข้า/ออก) → UIPT rankings (M แล้ว S, แยกชัด) → Portfolio actions → Hidden risk → Summary line
- **Market Narrative & News (บังคับทุกรายงานเต็ม):** เล่าเป็นเรื่อง ไม่ใช่แค่ตัวเลข — ① trigger of the day: ข่าวไหนขยับตลาด + ห่วงโซ่ข้ามสินทรัพย์ (เช่น ข่าว Iran → น้ำมันขึ้น → yield ขึ้นทั้งที่หุ้นลง) ② เรื่องของ indices (SPY/NDX/IWM แตกต่างกันแปลว่าอะไร, VIX term structure) ③ DXY/ทอง/น้ำมัน/BTC บอกว่าเงินหลบไปไหน ④ news×flow ทุกหัวข่าวที่ใช้: tag horizon + เช็คกับ CMF/IPI (ข่าวดีโดนขายใส่ต้องชี้) ⑤ rotation: เงินเข้า/ออก sector ไหนเพราะอะไร — ข่าวอ่านจาก `LATEST_FINANCIAL_NEWS` ใน formula csv (อยู่ใน digest/full.json แล้ว)

## 5) History & Reports (กันงานหาย) — มี 2 ชั้น

- **ชั้นทำงาน (ลบได้):** ทุก run เก็บ `history/<asof>_<fp>/{digest.md, full.json}` — เทียบย้อนด้วย `radar compare` · รายงานอยู่ `history/reports/`
- **ชั้นถาวร (ไม่มีคำสั่งไหนลบ):** `csv_archive/<stamp>/` + `report_archive/<stamp>/` ที่ root โปรเจกต์
- **รายงานทุกฉบับ (รวม follow-up: ยืนยัน port, เจาะรายตัว) ต้อง `radar save-report`** → เขียน `history/reports/` + **auto-stamp เข้า `report_archive/` ทันที** = รอดทุกการล้าง
- อ่านย้อนหลัง: `radar archives` (ดูรายการ stamp) → `radar archive-report [STAMP]` — ใช้ได้แม้ history/ ถูกล้างหมดแล้ว ห้ามตอบ "ไม่มีข้อมูล"
- เคลียร์: **`radar clear-all` = ค่าเริ่มต้น (archive ก่อน ล้างทีหลัง)** · `radar clean-csv` (csv ซ้ำ) / `radar clean-history 10` / `radar clean-all`+`force-mode` (ลบดิบ ไม่ archive — ใช้เมื่อยืนยันแล้วเท่านั้น) · **ห้าม `rm -rf` เอง** (ข้าม stamp = หายถาวร)

## 6) คำถามเฉพาะทาง (custom query)

```bash
skill-automate/radar json                      # path ของ full.json (ข้อมูลคำนวณครบทุกตัว)
skill-automate/radar py "import radar_lib,json; d=json.load(open('$(skill-automate/radar json)')); print(d['views']['NVDA'])"
```
โครง full.json: `views[SYM]` = {`1w/1d/4h/1h`: close,gc,rsi,e20/50/200,vwap,atr,cmf,cmf20,ipi,status,rvol · `_stage` · `_coil` · `_levels` · `px_now`}, `regime`, `sectors`, `portfolio`, `news`, `universe`

## 7) อ่านลึกเพิ่ม (read-only!)

ตำราเต็มอยู่ที่ `.claude/skills/us-stock-fund-manager/references/csv-uipt-screen.md` (Mode C ทั้งระบบ), `single-stock-thesis.md`, `macro-cascade.md` — **อ่านได้ ห้ามแก้**
