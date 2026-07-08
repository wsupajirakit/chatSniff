# Mode C — CSV / Multi-Timeframe UIPT Screen (offline data)

Use this mode when the user uploads a **formula file** (e.g. `ztrade_formula*.csv`) plus **multi-timeframe OHLCV exports** (1W / 1D / 4H / 1H, usually split `part1` + `part2`). This is a self-contained institutional screen run **from the provided files** — it does **not** require live web data, and typically runs in an environment where the network is disabled. The embedded `LATEST_FINANCIAL_NEWS` in the formula file is the intended news source.

This file is the operating manual for that workflow. Read it fully before touching the data.

## Table of contents
0. Run the bundled pipeline first (scripts/ + history/)
1. Golden rule: sanity-check the data BEFORE analyzing
2. File layout & loading
3. Market clock: sessions, ext hours, half-days, holidays, timezone
4. Recompute indicators correctly (CMF, RVOL, IPI)
5. Vocabulary (IPI vs IFI vs UIPT vs "UIPT Trap") + the real 4-phase UIPT system
6. Multi-timeframe confluence gate (anti-false-signal)
7. News × Flow confirmation gate
8. News horizon tagging (short / medium / long) + decay
9. Regime filter
10. Ranking: short vs medium screens
11. Entry-zone / stop / target construction
12. Portfolio mapping
13. Output shape

---

## 0. Run the bundled pipeline first (scripts/ + history/) — token & speed rule

All the mechanics in §1–§13 are already implemented in `scripts/radar_lib.py` and driven by `scripts/radar_run.py`. **Never rewrite them as ad-hoc session scripts.** From the project root:

```bash
.claude/skills/us-stock-fund-manager/scripts/run.sh                  # auto mode
.claude/skills/us-stock-fund-manager/scripts/run.sh --digest         # latest saved digest, no recompute
.claude/skills/us-stock-fund-manager/scripts/run.sh --compare        # diff two latest snapshots
.claude/skills/us-stock-fund-manager/scripts/run.sh --force          # recompute even if csv unchanged (history kept)
.claude/skills/us-stock-fund-manager/scripts/run.sh --force-mode     # user says "force-mode": wipe ALL history, recompute from newest csv
.claude/skills/us-stock-fund-manager/scripts/run.sh --clean-csv      # delete superseded csv duplicates
.claude/skills/us-stock-fund-manager/scripts/run.sh --clean-history 10  # keep newest 10 snapshots
.claude/skills/us-stock-fund-manager/scripts/run.sh --clear-all      # user says clear/reset/เตรียม set ใหม่: STAMP to legacy archive, THEN wipe working csv/+history/
.claude/skills/us-stock-fund-manager/scripts/run.sh --archives              # list every legacy set ever stamped (read-back index)
.claude/skills/us-stock-fund-manager/scripts/run.sh --archive-report [STAMP]  # print an archived report (default: newest), no recompute
```

**CSV freshness & duplicates (fully automatic — do not hand-inspect):** the loader picks the newest file per timeframe/part by mtime (handles `(N)` download copies), and the snapshot fingerprint is a **content hash with normalized names** — a re-uploaded duplicate (new filename + new mtime, same bytes) maps to the same fingerprint, so auto mode reuses the saved snapshot instead of recomputing. Genuinely new data → new fingerprint → fresh run. The digest header shows the newest csv mtime so staleness is visible at a glance.

**Cleanup protocol:** when the user asks to clear/reset/ลบประวัติ/เตรียมรอ set ใหม่, the safe default is **`--clear-all`** — it STAMPS the current working set into the permanent legacy archive first, *then* wipes `csv/` + `history/` (see "Legacy archive" below). Do NOT `rm -rf` the dirs by hand — that skips the stamp and loses the set forever. Narrower tools when you only want to prune, not reset: `--clean-csv` removes superseded csv copies (keeps the newest per tf/part + formula); `--clean-history N` prunes old snapshots keeping the newest N (`0` = delete all). The older `--clean-all` / `--force-mode` are destructive wipes that do NOT archive — prefer `--clear-all` for any user-facing reset. Never delete the newest csv set unless the user says so.

- **Auto mode** fingerprints the newest `csv/` set: unchanged → prints the saved digest (cheap); new → full screen, saves `history/<asofET>_<fp>/{digest.md,full.json}` and updates `history/LATEST`.
- The digest is the compact input for the report. What it does NOT do (still Claude's job): the regime *call* and permission level (it only prints a `permission_hint`), news horizon×flow tagging, entry/stop/target narratives, portfolio *actions*, hidden-risk pick, and the Core Radar summary line.
- What the library already handles: newest-file selection (`(N)` copies), tz-shift auto-detect/correct (old exporter bug stamped bars at ET−7h), forming-bar drop, session-correct IPI/CMF/RVOL recompute (file `IPI_Status` from old exports is poisoned — ignored), holiday-week RVOL scaling (equity days only — crypto/fx must not mask holidays), kill switch + staging + coil detector + levels, `my_port.md` parsing and marks.
- RVOL convention: 1H/4H = exporter `Rvol_Tod`; 1D/1W = `V/SMA20` per the formula-file spec (the exporter's weekly `Rvol_Tod` disagrees with the spec and flips borderline IPI names — do not use it for weekly gates).
- For bespoke questions, `import radar_lib` (add `scripts/` to `sys.path`, run with `scripts/.venv/bin/python`).

**Report archive (survives clean-all):** after writing a report — the initial screen AND every follow-up analysis delivered in later turns (port confirmations, single-name deep-dives, plan revisions) — ALWAYS persist it with `run.sh --save-report <file>`. It writes `history/reports/report_latest.md` (always newest, overwritten each run), a dated archive copy `history/reports/report_<YYYYMMDD_HHMM>_asof<...>.md`, **and auto-stamps that dated copy into the permanent `report_archive/<stamp>/` immediately** — so even an `rm -rf history/` or a later `--clear-all` can never lose a saved analysis. The `history/reports/` dir is never touched by `--clean-csv`, `--clean-history`, `--clean-all`, or `--force-mode` (those only remove `\d{12}` snapshot dirs). When the user asks "เทียบกับเมื่อวาน/รอบก่อน" and snapshots were cleared, read the dated files in `history/reports/`, or fall back to `--archives` / `--archive-report` if history/ itself is gone.

**Legacy archive (permanent — the long-term memory):** two storage tiers behave oppositely on a reset.
- **Working (disposable):** `csv/` (raw uploaded set) + `history/` (snapshots `<asof>_<fp>/` with digest.md/full.json/report.md + `history/reports/`). The pipeline reads/writes this each run; `--clear-all`/`--clean-*`/`--force-mode` clear it.
- **Legacy archive (never auto-cleared):** `csv_archive/<stamp>/` (a copy of that run's csv set) + `report_archive/<stamp>/` (digest.md + report.md + full.json + MANIFEST.txt). `<stamp>` = the snapshot name `<asof>_<fp>` so sets sort chronologically. **`--clear-all` copies BOTH the history snapshot (digest/full) AND the report into here before wiping** — so nothing is lost, only reset.
- **Read history back** (works even after every working dir was wiped): `run.sh --archives` lists all stamps with what each holds (`R`=report, `D`=digest, `J`=full.json, csv count); `run.sh --archive-report <stamp>` prints that report (omit stamp = newest). Use these when the user asks about a *past* screen/portfolio ("ล่าสุดเป็นไง", "ดูย้อนหลัง", "legacy"). Note `--digest` only reaches the *current* `history/`; once cleared, the legacy archive is the only source — reach for `--archives`/`--archive-report`, never say "no data". **The archive may be empty** (fresh clone, or `--clear-all` ran with nothing to preserve → it skips and creates no folder); `--archives` then prints "no legacy archives yet" instead of erroring. Fall back to current `history/` (`--digest`); if that is empty too, state plainly there is no prior screen and ask for a CSV set — do not fabricate one.

**§14 History protocol:** every run persists to `history/`. If the user asks for a screen and there is **no new CSV**: load the latest snapshot (`--digest`), state its as-of prominently ("data unchanged since …"), re-verify the conclusions against the stored `full.json`/`report.md` and rewrite what no longer holds — do not refuse for lack of data, and do not present stale prices as live. If new CSVs arrived: run fresh, then `--compare` to lead the report with what CHANGED (stage moves, kill-list adds/drops, 1D-CMF flips = exit rule). After delivering a report, write it to `history/<snapshot>/report.md` so the next session can recall conclusions without re-deriving them.

## 1. Golden rule: sanity-check the data BEFORE analyzing

**Never run the screen on unverified data.** Every real failure in practice came from skipping this. Before any ranking, run these checks and report anything that fails instead of silently analyzing:

- **CMF bounds:** CMF must be within **−1..+1**. If `max(CMF) > 1` or `< −1` (seen: values up to 260), the exported CMF is broken — **recompute it yourself from OHLCV** (Section 4) rather than trusting the column. State that you did so.
- **Price/Split jumps:** if a symbol's price jumps ~2×/4×/10× between files with no news, check whether the *whole historical series* rescaled (→ **stock split**, legitimate — adjust cost basis & shares) vs a single bad value (→ data error). Ratio ≈ 4.0 → 4:1 split. Do **not** call a split a "price error" without checking the series, and do not call an error a split. Adjust the user's cost basis and share count accordingly.
- **Ext-hour poisoning:** if the latest bar is pre-market/after-hours (thin volume), IPI/CMF classifiers skew (seen: 114/120 symbols flipped to "Distribution" on one thin bar). Detect via `market_state` (Section 3) and **exclude ext/low-volume bars** from indicator reads.
- **Staleness:** the newest bar timestamp is your "as-of." You have **no live clock** — infer the as-of from the data, state it, and flag that price may have moved since. Never imply you can see the current price when you can't.
- **IPI validity:** if the file's `IPI_Status` is dominated by one class or tied to broken CMF, fall back to a proxy: `ACC = CMF>0 & RVOL>1.2`, `DIST = CMF<0 & RVOL>1.2`, else Neutral.

Put a one-line data-health note at the top of the output ("CMF recomputed; CRWD split-adjusted 4:1; 1H latest = ext, using 1D/1W for flow").

## 2. File layout & loading

Typical set: `ztrade_export_{1w,1d,4h,1h}_part{1,2}[_vN].csv`, columns roughly:
`Symbol, Datetime, Open, High, Low, Close, Volume, EMA_20/50/100/200, RSI, OBV, CMF, VWAP, FVG, RVOL, RVOL_Deviation, IPI, IPI_Status`.

- Concatenate `part1`+`part2` per timeframe; parse `Datetime` with `format="mixed"` (1D/1W sometimes carry a date-only stamp).
- Sort by `Symbol, Datetime`. Universe is typically 90–125 symbols. **Do not skip symbols** — the screen must cover all of them (this is a stated requirement of the framework).
- Read the formula file separately for `ROLE_CORE_RADAR`, the rule set, and `LATEST_FINANCIAL_NEWS`.

## 3. Market clock: sessions, ext hours, half-days, holidays, timezone

The exporter should stamp this, but verify/derive it yourself:

- **Timezone:** store/compare in **UTC**, convert to **America/New_York** to judge sessions. Never trust the local machine clock (the user is often in another tz). ET has DST — never hardcode the offset; `zoneinfo` handles it.
- **Calendar:** use an exchange calendar (`pandas_market_calendars`, `XNYS`) to know holidays, weekends, and **early-close (half) days** — don't hardcode. Half-days close 13:00 ET.
- **State machine** — classify the latest bar / "now": `PREMARKET / OPEN_RTH / OPEN_HALF / AFTERHOURS / CLOSED_POST / CLOSED_HOLIDAY_OR_WEEKEND`.
  - `OPEN_RTH` → 1H/4H flow is usable live.
  - `OPEN_HALF` → usable, but scale `RVOL ÷ (session_minutes/390)` so a short day doesn't look like volume evaporated.
  - `PREMARKET / AFTERHOURS` → treat 1H/4H latest bar as **ext**: exclude from IPI/flow; analyze from 1D/1W instead.
  - `CLOSED_HOLIDAY_OR_WEEKEND` → no new bar; use last close, don't synthesize a zero/thin bar.
- **Closed-bar only:** compute indicators on **closed** bars. A still-forming bar has incomplete volume and will distort CMF/RVOL.
- Convention: **1H/4H may include ext hours; 1D/1W are RTH-only.** Build daily/weekly from RTH bars so half-days/holidays don't inject junk.

## 4. Recompute indicators correctly

If the file's CMF fails the bounds check, recompute CMF(20):
```
hl  = High - Low
MFM = where(hl<=0, 0, ((Close-Low) - (High-Close)) / hl)   # guard High==Low → 0, not NaN/inf
MFV = MFM * Volume
CMF = MFV.rolling(20).sum() / Volume.rolling(20).sum()       # MUST divide by ΣVolume
assert CMF.between(-1, 1).all()                              # clip/assert before use
```
The two classic export bugs: (a) forgetting the `ΣVolume` denominator → values explode into the hundreds; (b) not guarding `High==Low` → sign flips on tiny-range bars. **RVOL** is most honest as *time-of-day*: compare a 10:00 bar's volume to the average of prior 10:00 bars, not to a whole-day average (this is what keeps half-days honest).

## 5. Vocabulary — these are DIFFERENT things (do not conflate)

Read the formula file's own definitions; the acronyms are distinct:

- **IPI = Institutional Power Index** — a **score/status**, not a system. `IPI = (CMF*100) + (RVOL_Deviation*0.5) + (Norm_OBV_Slope*50)`, computed only on **closed RTH bars with RVOL_slot > 0.3** (else `N/A (ext)` / `N/A (low vol)`). Classify: `>50` = Institutional Accumulation, `-20..50` = Neutral, `<-20` = Institutional Distribution. (Norm_OBV_Slope = OBV change vs prior bar, normalized by the 50-bar stdev of the slope, clipped −1..1.)
- **IFI = Institutional Flow Index** — a separate SmartMCDX-style classifier using Mean ± 0.5·SD of an IFI_Score over 50 bars (red = smart money, green = distribution, yellow = neutral). Don't confuse with IPI.
- **UIPT = Ultra Institutional Pivot Trigger** — a **full 4-phase trading SYSTEM** (below), *not* a single pattern and *not* the word "trap."
- **"UIPT Trap"** — narrower: the **Rule 6** pattern to watch for during scanning — a latest candle showing Distribution that is actually mechanical (preceded by Accumulation on RVOL>1.2, CMF still positive). It is a detection heuristic *inside* the scan, not the UIPT system itself.

## 5b. UIPT — the real 4-phase system (Top-Down)

UIPT is **conservative and gated**. Run the phases in order; a name only advances if the prior phase passes.

- **Phase 1 — Core Engine:** compute IPI (formula above) + Volume Anomaly (`RVOL_Deviation > 50%`) + Momentum Validation (`OBV Slope > 0` for ≥2 consecutive bars).
- **Phase 2 — Long-Term Macro Filter (1W & 1D):** require **Golden Cross** — `Close > EMA50` **and** `EMA50 > EMA200` on **both** 1W and 1D — **and** `1W CMF > 0` **and** `1W IPI = Institutional Accumulation`. **⛔ Kill Switch:** if **1W or 1D IPI = Institutional Distribution**, the name is **blocked immediately** (→ Kill List), no matter how good the lower TFs look. This is the single most important gate and is far stricter than "1D had some accumulation lately."
- **Phase 3 — Medium-Term Setup Window (1D & 4H):** price pulled back to test **EMA20 or EMA50** (must **not** lose EMA200), **1D/4H RSI resting in 40–60** (overbought cleared), 4H IPI may sit Neutral **but 1D CMF must be > 0**.
- **Phase 4 — Short-Term Sniper Trigger (1H):** `1H reclaims/crosses VWAP` + `1H RVOL_Deviation > 50%` + `1H OBV Slope > 0` + `1H IPI flips back to Institutional Accumulation`. (Phase 4 needs a **live RTH 1H bar** — it cannot fire on an ext/pre-market bar.)
- **Exit / Cut:** force-close if **1D CMF flips negative** or **1D IPI = Distribution**.

Map phases to a **stage** for the output: `MACRO-WATCH` (P2 only) → `SETUP` (P2+P3, "standby/ready") → `TRIGGER` (P2+P3+P4, fire). Anything hitting the Kill Switch → **Kill List**.

**Reality check:** in a distribution-heavy tape most of the universe fails Phase 2 (Golden Cross + 1W Accumulation) or hits the Kill Switch — it is normal for only a handful of names to reach SETUP, and for **zero** to reach TRIGGER when the latest 1H bar is ext. Do **not** substitute a loose "1H CMF>0 + 1D had accumulation" screen and call it UIPT — that is only Rule-6 trap candidate-hunting and will surface names UIPT would have Kill-Switched. If the user explicitly wants the looser trap scan, label it "Rule-6 trap candidates," not "UIPT."

## 6. Multi-timeframe confluence gate (anti-false-signal)

**A single timeframe lies.** The recurring trap (e.g. a name whose 4H CMF is still positive from yesterday while the 1H is already rolling over and price has lost its 1H EMA20) must be filtered out. Before promoting anything to "enter now":
- require the **current 1H** to confirm the higher TFs (price ≥ 1H EMA20, 1H CMF > 0 and not collapsing over the last ~3 bars, latest daily not a big red distribution-reversal);
- if the TFs disagree, downgrade to **Watch**, not Buy;
- a 4H CMF that is positive only because it hasn't updated to the latest drop is **stale** — always cross-check the freshest 1H print and the raw price direction.

## 7. News × Flow confirmation gate

**Good news only counts if the flow confirms it.** A bullish headline with **negative CMF** means the good news is being *sold into* — that's a **sell/avoid** signal, not a buy (observed: a megacap popped ~10% on a headline while 1H CMF read −0.45; it kept being distributed). Rule: `bullish_news AND CMF>0` → confirmed; `bullish_news AND CMF<0` → "sold into," do not issue a buy. Symmetrically for bearish news with positive CMF (capitulation being absorbed).

## 8. News horizon tagging (short / medium / long) + decay

Tag every headline so its weight matches its true half-life:

| News type | Horizon | Note |
|---|---|---|
| Earnings, price target, analyst call, single-name item | **Short** (days) | decays fast; fade after 2–3 sessions |
| Single monthly data point (jobs, CPI print) | **Short–Med** | lives until the next print |
| Fed path / rate-policy stance | **Medium** (weeks–months) | re-rates the whole discount rate |
| Regulatory / antitrust fine on one name | **Short** (one-off) | usually a clearing event once the number is known |
| Structural (stagflation, private-credit stress, AI-capex cycle, sustained geopolitical) | **Long** (quarters+) | keep full weight; these move regimes |

Also tag **scope** (macro / sector / single-name) and **direction + magnitude** (cue words: "record", "freak out", "surges", "warns"). Apply **decay**: short-horizon news loses weight each day so the screen doesn't keep trading a dead catalyst; structural news holds weight.

## 9. Regime filter

The same signal means different things in different regimes. Read the macro/index tape first (VIX, breadth/TICK, HYG credit, DXY, yields, SPY/NDX/SOXX flow) and set **Risk-On / Risk-Off / Transition**. In Risk-Off, shrink size and suppress fresh longs even on clean UIPT setups; call out the single **hidden risk / contagion** (credit spreads, yen-carry unwind, etc.) explicitly. HYG breaking its EMA200 or VIX spiking through its recent shelf = stop adding, raise cash.

## 10. Ranking: short vs medium screens

Produce **two separate rankings**, and exclude pure index/macro tickers (and, for "hidden gems," the obvious megacaps) so the list surfaces real setups. Be explicit about which screen you ran:
- **Medium-term** is where the **true UIPT stages** live: rank the Phase-2/3 survivors (MACRO-WATCH → SETUP), require the Golden Cross + 1W Accumulation + no Kill Switch, weight 1D/1W accumulation and structure above EMA50/EMA200, penalize over-extension (>~40% above EMA200) and hot daily RSI. These match a 1–4 month horizon.
- **Short-term** is either the Phase-4 TRIGGER list (when a live RTH 1H bar exists) or, if the user wants a looser momentum scan, the **Rule-6 trap candidates** — weight 1H/4H flow, ignition (Accumulation bar with high RVOL), price ≥ 1H EMA20, **penalize hot RSI (>75)**. Label it honestly ("Rule-6 trap candidates" vs "UIPT TRIGGER"); do not present a loose momentum list as if it passed the full UIPT gate.
- Always tag each name with an "entry now / wait-for-pullback / wait-for-breakout" state based on RSI and distance to the nearest swing high; never label an extended, RSI-77 name "enter now."

## 11. Entry-zone / stop / target construction

For each actionable name pull real levels from the data — **EMA20/50 (1H and 1D), VWAP, recent swing high/low, ATR(14)** — and give tiered entries:
- **Pullback entry:** the EMA/VWAP support cluster (best risk/reward).
- **Breakout entry:** reclaim/close above the nearest swing high with RVOL.
- **Stop:** below the structural level, sized in **ATR units** (not a flat %), so a high-ATR name gets appropriate room and a low-ATR name isn't given a stop that's really noise.
- **Invalidation:** state the flow condition that kills the setup (1H CMF flips negative / loses the EMA cluster).
- Apply a **liquidity gate:** require a minimum dollar-volume before a small-cap can rank, so thin names whose CMF whipsaws don't top the list.

## 12. Portfolio mapping

If a portfolio/watchlist is attached, map every holding to its screen verdict (Trap / Kill / Watch / hold), compute P&L vs cost from the current data (split-adjust cost basis where needed), and give concrete per-position actions with share counts and levels: trim overbought winners into strength, cut confirmed Kill-List distribution, hold flow-positive cores, and stage dry powder into confirmed entries. Check **concentration** before recommending adds (don't push a name that's already the largest weight). If cash is held in another currency, convert at the rate visible in the data (e.g. a `USDTHB` series if present) rather than guessing, and flag it as approximate if not present.

## 13. Output shape

Lead with the **data-health note** and the **regime line**, then — MANDATORY, never compress it away — the **Market Narrative & News layer**, then sector flow, then the two ranked screens (short / medium) as tight tables, then per-name entry tables, then the portfolio actions, then a short **hidden-risk** line. Close with the standard Core Radar summary: `Regime — Top Watchlist: X, Y, Z`. Keep the "analysis, not personalized advice" line to one short mention. Respond in the user's language (Thai → Thai), finance terms in English.

**Market Narrative & News layer (required in every full screen):** this is the "what is the market DOING and WHY" story the user reads first, built from the formula file's `LATEST_FINANCIAL_NEWS` + the macro table. It must contain, in prose (not just numbers):
1. **Trigger of the day** — which headline(s) moved the tape, and the cross-asset chain it caused (e.g. Iran headline → oil ↑ → yields ↑ while stocks ↓ = no flight-to-bond, stagflation-flavored risk-off).
2. **Indices story** — SPY/NDX/IWM with divergences interpreted (small-caps leading down = risk appetite shrinking), plus VIX term structure meaning.
3. **DXY / gold / oil / BTC narrative** — what each is saying about where money hides (e.g. gold failing as a haven while USD absorbs the flow), each tied to a headline when one explains it.
4. **News×Flow verdicts** — for every headline actually used: tag horizon (short/medium/long + decay) and check it against CMF/IPI of the affected sector/name; call out "sold-into" bullish news and absorbed bearish news explicitly (§7–8).
5. **Rotation read** — which sectors money is entering/exiting and the one-line why (links to the sector-flow table).
Skipping this layer (jumping from regime straight to rankings) is an output-shape violation — the user has flagged it; do not let terse formatting drop the narrative.
