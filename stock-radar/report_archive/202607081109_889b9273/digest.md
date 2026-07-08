# Radar digest — as-of 2026-07-08 11:09:14.663219 ET | fingerprint 889b927351fb75a7
market_state(header)=OPEN_RTH | files=8 (newest mtime 2026-07-08 22:10) | universe=184
**screen_mode: FULL** — timeframes present: 1w+1d+4h+1h

## Data health
- timestamps already ET-correct (fixed exporter)
- symbol counts differ across TFs: {'1w': 182, '1d': 183, '4h': 184, '1h': 184}

## Layer-0 regime
permission_hint: **RISK-OFF (tripwire fired)**
- US10Y->4.55: 4.58 (+0.8%)
- DXY->101.8/100.0: 101.13 (-0.7% / +1.1%)
- WTI->72: 74.59 (+3.6%)
- VIX/VIX3M: 0.89 (contango)
- VIX9D/VIX: 0.88
- HYG_vs_E200D: 79.76 vs 80.1 (BELOW!)
- breadth (1D): GC 37% | CMF50>0 50% | CMF20>0 36% | kill 130/171

> หมายเหตุ (recovered): digest ฉบับนี้ถูกกู้จากบทสนทนาหลังถูกลบด้วย rm -rf โดยไม่ตั้งใจ
> ตาราง macro/sector/UIPT/levels/portfolio marks เต็ม อยู่ในไฟล์ report.md ของ snapshot เดียวกัน
> fingerprint + as-of ตรงกับ CSV set ใน csv/ (ยังไม่ถูกลบ) — recompute ได้ด้วย run.sh --force ถ้าต้องการตารางเต็มกลับ

## Regime summary
SPY 744.39 (-0.44%, Dist/Accum) | NDX 29086 (Dist/Accum) | IWM 293.43 (Dist/Dist)
VIX 17.38 (+7.68%) | HYG 79.64 (below E200D 80.1) | Gold 4059 | WTI 74.59 | BTC 62046

## UIPT survivors (non-KILL/non-FAIL)
GOOGL=SETUP | XLV/XBI/CRWD/DUK/SKWD/USFD=MACRO-WATCH | OTTR=SETUP(loose)
WATCH(loose): DDOG, CIBR, FTNT, PANW, NI, SKYY, EXEL, UTI, VRNS

## Portfolio marks (19)
SNPS -8.6% KILL | ETN +7.8% KILL | BWXT -6.6% KILL | META -5.2% FAIL | GOOG -0.3% KILL
PWR +57.7% KILL | MSFT +1.1% FAIL | FCX -12.9% KILL | TSM +30.7% KILL | CRWD +87.7% MACRO-WATCH
NET +33.6% FAIL | RBRK +29.5% KILL | MTZ +96.6% KILL | COHU -8.1% KILL | CIBR +10.0% WATCH
PAVE -0.9% KILL | DDOG -3.0% WATCH | LMT +2.3% KILL | META(swing) +2.0% FAIL

> Method: IPI recomputed on corrected-ET RTH closed bars. CMF = file CMF(50) [in-bounds]; cmf20 = fast recomputed flow.
