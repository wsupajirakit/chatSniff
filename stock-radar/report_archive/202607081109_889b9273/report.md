# Core Radar + UIPT-M(2W) + UIPT-S(3D) + Portfolio — as-of 2026-07-08 11:09 ET (22:09 ไทย)

## Data health
- ไฟล์ 8 ชุด + formula, mode FULL (1W/1D/4H/1H ครบ), universe 184
- timestamps ET-correct (exporter ที่แก้แล้ว), CMF in-bounds, IPI recompute จาก closed RTH bars
- 1W ขาด 2 ตัว (182/184, เช่น SPCX = NO-DATA รายตัว ไม่กระทบทั้งจอ)
- แท่งกลางวัน (11:09 ET ตลาดเปิดอยู่) — 1H rvol ส่วนใหญ่ < 1 ระวังสัญญาณ 1H หลอก

## Regime: RISK-OFF (ยืนยัน — tripwire ติดพร้อมกัน 3 ตัว)
- **HYG 79.64 < EMA200D 80.1** (เครดิตยังพัง — ตัวชี้ขาดหลัก)
- **US10Y 4.58 > 4.55** | **WTI 74.59 > 72 (+3.6%)** ← ข่าว "Trump: Iran interim deal is over" ดันน้ำมัน
- VIX 17.38 (+7.7%) เย็นลงจากเช้า (18.08) แต่ **VIX9D +13.7% → VIX9D/VIX 0.88** = ตลาด price event ระยะสั้น
- Breadth ยังพัง: **KILL 130/171 (76%)** | GC 37% | CMF20>0 แค่ 36% — เท่าเช้า ไม่ฟื้น
- SPY 744.39 (−0.44%) เด้ง intraday จากเช้า แต่ 1D IPI ยัง Dist ทั้ง SPY/NDX/IWM
- **คำตัดสิน: RISK-OFF ต่อ — ห้ามเปิด long ใหม่เต็มไซซ์, defensive + watchlist เท่านั้น**

## Cash / FX / Commodities
- DXY 101.13 ทรงตัว, USDTHB 33.48 — เงินสด USD ยัง position ที่ดี
- Gold 4059 (1D Dist) — ข่าวจีน: **record gold ETF outflows โยกเข้าหุ้น** = ทองพักตัว
- WTI 74.59 ขึ้นจาก Iran headline — ถ้ายืนเหนือ 75 = แรงกดเงินเฟ้อรอบใหม่
- BTC 62,046 (1D Dist, ใต้ E200D) — risk appetite ยังไม่กลับ

## Sector flow — เงินไปไหน
- **เงินเข้า (หลบภัย): XBI (RS20 +26, Accum/Accum) > XLV (Accum/Accum)** — healthcare/biotech นำชัด
- ประคอง: XLF, ITA, CIBR (RS60 +36 โครงยาวยังดี), utilities รายตัวรอด kill (DUK/NI/OTTR)
- **เงินออกแรง: XME −15, UFO −12.7, COPX −8.8, PAVE, XLRE** — commodity/materials/infra โดนทิ้ง
- Semis กลางๆ: SOXX/SMH RS20 ~+0.8 แต่ 1D Dist — ยังไม่ใช่ที่หลบ
- ภาพ = **defensive rotation คลาสสิก** สอดคล้อง RISK-OFF

## UIPT-M (ระยะกลาง ~2 สัปดาห์+) — Phase-2 survivors: เหลือแค่ 8 จาก 184
| # | ตัว | stage | px | จุดเด่น | แผน (ถ้า regime คลาย) |
|--|--|--|--|--|--|
| 1 | **XLV** | MACRO-WATCH | 163.34 | 1W+1D Accum, ext แค่ 10% | สะสม pullback 156.6 (E20d), stop 152.7, ต้าน 165.6 |
| 2 | **GOOGL** | **SETUP** (เดี่ยวตัวเดียว) | 362.66 | 1W Accum, นั่งบน E20/E50d 360.5/359.4 | เข้าโซน 359–362, stop 348 (E50d−1ATR), TP1 376 |
| 3 | **XBI** | MACRO-WATCH | 162.26 | จ่อ pivot 164.35 (−0.2%), Accum ทุกชั้น | breakout เหนือ 164.35 + rvol>1.5 เท่านั้น |
| 4 | SKWD | MACRO-WATCH | 62.12 | 1D Accum cmf20 +0.35 | จ่อ pivot 63.03 แต่ vol บางมาก — เฝ้า |
| 5 | USFD | MACRO-WATCH | 101.54 | defensive staple | pullback E20d 96.6 |
| 6 | DUK | MACRO-WATCH | 128.04 | utility หลบภัย ext 3% | pullback 126 |
| 7 | CRWD | MACRO-WATCH | 189.54 | แข็งสุดในพอร์ต แต่ ext 48% | ถือของเดิม ห้ามไล่ |
| 8 | OTTR | SETUP(loose) | 90.20 | utility เล็ก | รอง |

⚠️ ข้อสังเกต: GOOGL(A) = SETUP แต่ GOOG(C) = KILL (1D IPI −40 vs +27, flow สองคลาสแตกต่าง) → Alphabet = **ก้ำกึ่ง** อย่าอ่านเป็นไฟเขียวเต็ม

## UIPT-S (เล่นสั้น 1–3 วัน) — คำตอบตรง: **วันนี้ไม่มีตัวเข้าได้**
กติกา RISK-OFF: งดเปิด long ใหม่ — ที่ให้คือ "จ่อยิง" รอเงื่อนไขปลด (HYG > 80.1 + VIX < 16):
1. **XBI 162.26** — ห่าง pivot 164.35 แค่ −0.2%, 1H cmf +0.14 · ปลดล็อกแล้วค่อยเล่น breakout, stop 160.3 (−0.5×ATR), TP 168
2. **XLV 163.34** — pivot 165.6 (−1.5%), rvol 1.12 มีคนเทรดจริง · แต่ 1H IPI Dist = รอ 1H พลิกก่อน
3. **UTI 51.00** — ชน pivot 51.25 พอดี cmf20 1H +0.34 · แต่ rvol 0.42 + ext 47% = **เสี่ยง trap สูง ข้ามได้ข้าม**
- DDOG (rvol 1.51, 1D Accum) น่าสนใจแต่ราคาใต้ E20-1H 256.25 = ยังไม่ ignite

## Portfolio (19 posn | net unrealized ≈ +$9,500)
สถานะ: 11 KILL / 4 FAIL / 1 MACRO-WATCH (CRWD) / 2 WATCH (CIBR, DDOG)
- **CRWD +87.7%** — แกนพอร์ต แข็งสุด ถือต่อ (แต่ ext 48% ห้ามเติม)
- **PWR +57.7% / MTZ +96.6%** — 1W Dist ทั้งคู่ → **ยืนคำแนะนำ trim ½ ล็อกกำไร** (PWR ใต้ E50d 687 แล้ว)
- **SNPS −8.6%** — พังทุก TF (ใต้ EMA ทุกเส้น) → ใช้เด้งหา 456 (E20d) เป็นทางออก ไม่ถัวเพิ่ม
- **FCX −12.9%** — นั่งบน E200D 57.05 (px 57.76) **เส้นตาย 57**: หลุด = ตัด, ยืนได้ = ถือ
- **ETN +7.8%** — 1W พลิก Dist, stop ที่ E200d ~375 (ราคา 397 ยังมีบัฟเฟอร์)
- **TSM +30.7%** — 1W Accum โครงยาวดี, 1D Dist ชั่วคราว — ถือ, เฝ้า E50d 420
- **META / MSFT** (FAIL แต่ 1W Accum) — megacap ถือได้ เฝ้า reclaim E200d (630 / 426)
- **GOOG −0.3%** — ก้ำกึ่ง (คลาส A = SETUP) ถือ ไม่เติมช่วง RISK-OFF
- **RBRK +29.5% / LMT +2.3% / BWXT −6.6% / COHU −8.1% / PAVE −0.9%** — KILL ทั้งหมด: ไม่เติม, LMT รอ 1D กลับเหนือ GC, BWXT/COHU/PAVE ตั้ง stop วินัย
- **ห้ามซื้อใหม่ทุกตัววันนี้** — breadth 76% KILL ยังไม่ใช่จุดกลับ

## Hidden risk (ที่ consensus มองข้าม)
**น้ำมัน × ดอกเบี้ย spiral**: WTI ทะลุ tripwire พร้อม US10Y 4.58 — ถ้า Iran escalate ต่อ น้ำมัน >75 จะฆ่าความหวังลดดอกเบี้ย ทำให้ 76% KILL breadth กลายเป็น downtrend จริง ไม่ใช่ dip · รอง: เงินหลบเข้า XLV แต่ข่าว "Health insurance giants fighting break-up efforts" = policy risk ซ่อนอยู่ใน sector หลบภัยเอง · VIX9D พุ่ง = ตลาด price event ใน ~9 วัน (จับตา CPI/Fed)

## จุดชี้ขาดพรุ่งนี้
**HYG กลับเหนือ 80.1 ได้ไหม** — ได้ = เริ่มนับหนึ่งกลับเข้า (ปลด UIPT-S ที่จ่อไว้) · ไม่ได้ = defensive ต่อ

**Core Radar Summary: RISK-OFF — Top Watchlist: GOOGL, XBI, XLV (ถือแกน CRWD)**

*บทวิเคราะห์ ไม่ใช่คำแนะนำการลงทุนส่วนบุคคล*
