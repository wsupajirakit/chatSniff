# Mode A — Single-Stock Thesis (US equity)

Produce a high-conviction thesis for the ticker across **three horizons**: short-term (1–5 days), medium-term (1–3 months), and long-term (1 year+). Use live data gathered in Step 2. Keep the structure below in order. Substance over decoration — but every section must be present.

Open with a one-line snapshot: ticker, company, sector, current price (with the as-of time of your data), and the single sentence that captures the thesis.

## 1. Macro & Micro — the top-down view

**Macro.** How do current US Treasury yields, inflation (CPI/PCE), and Fed rate expectations specifically hit *this stock's sector*? Be concrete about the transmission (e.g. rate-sensitivity of the multiple, funding costs, demand cyclicality), not generic.

**Micro (idiosyncratic risk).** What is company-specific here? How does its supply chain, input exposure, and market share in its industry look versus ~12 months ago? Name the one or two risks that are specific to *this* company rather than the whole sector.

## 2. Fundamental & Financial deep-dive (FA)

**Quality of earnings.** From the most recent 10-Q/10-K: is revenue growth driven by *volume* or just *price*? Note the Debt-to-Equity ratio and the Free-Cash-Flow yield. Call out anything that flatters the headline (one-offs, channel stuffing, capitalization choices) if visible.

**Valuation.** Compare current **P/E, P/S, and PEG** against the stock's own ~5-year historical mean *and* against its primary competitors. If the user supplied competitor names, use those; otherwise pick the two most relevant US-listed peers and say why. State whether the stock looks rich, cheap, or fair on each metric and which metric matters most for this business.

## 3. Technical Analysis (TA)

**Structure.** Identify the current phase: Accumulation, Markup, Distribution, or Decline — and justify it from price/volume behavior.

**Indicators.** Analyze the interaction of the **50-day and 200-day** moving averages (golden/death-cross posture, slope). Check **RSI** for overbought/oversold, and **MACD** for trend strength or exhaustion. Where you don't have exact indicator values, derive direction from sourced recent data and label it approximate.

**Volume profile.** Note where the **Point of Control (POC)** / high-volume node sits, and whether price is trading above or below it. If volume-profile data isn't available, say so and use the clearest support/resistance you can source instead.

## 4. News & Sentiment

**Catalyst check.** Scan roughly the last 72 hours: pending FDA decisions, the next earnings date, guidance, regulatory/legal actions, product events, insider activity. List dated catalysts.

**Sentiment.** Characterize positioning — analyst tone, social/retail attention, and options flow (put/call ratio) if retrievable — and translate it into a fear/greed read for *this ticker specifically*. Note when sentiment and fundamentals disagree.

## 5. Final Synthesis & Execution Plan

- **The Verdict — Conviction Score 1–10**, with one line on what drives it.
- **The Trade (per horizon where it makes sense):** an **entry zone**, a **hard stop-loss** placed using roughly **2.0× ATR**, and **three tiered take-profit targets**. Present these as a scenario for the user's own decision, not an instruction.
- **Risk — the one black-swan event** that would invalidate the entire thesis.
- **Next data point to watch** — a specific release, date, or price level.

End with one brief line noting this is analysis for the user's own decision-making, not personalized financial advice.

## Timeframe modifiers

If the user specifies a focus, re-weight accordingly:

- **Short-term (day/swing):** lean on intraday structure (15m/1h), VWAP, and the current day's news catalysts. De-emphasize 5-year valuation.
- **Medium-term (position):** lean on the weekly-chart structure, upcoming quarterly guidance, and sector-rotation trends.
- **Long-term (investing):** lean on the moat, management/CEO track record, and multi-year CAGR projections. De-emphasize short-term RSI noise and daily headlines.

If a single-stock request is clearly driven by a macro catalyst, you may append a brief note on second-order beneficiaries (a light touch of the Mode B Layer-6 lens) — but keep the spine of the response the single-stock structure above.
