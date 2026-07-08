"""radar_lib — reusable fund-manager functions for the CSV/UIPT screen (Mode C).

Everything the skill previously rebuilt ad-hoc per session lives here:
loading, sanity checks, tz normalization, indicator recompute (CMF/OBV/RVOL/IPI),
Layer-0 regime, sector flow map, UIPT staging + kill switch, coil detector,
entry levels, portfolio marks, compact digest, and history snapshots.

Design goal: `radar_run.py` prints ONE compact digest; all detail goes to
history/<asof>/full.json so future sessions read files instead of recomputing.
"""
from __future__ import annotations
import glob, hashlib, io, json, os, re
import numpy as np
import pandas as pd

TFS = ["1w", "1d", "4h", "1h"]
BAR_HOURS = {"1h": 1, "4h": 4, "1d": 24, "1w": 168}
# symbols that are indices/futures/fx/crypto — no equity session, some no volume
NONEQ_KNOWN = {"BTCUSDT", "DXY", "US10", "US10Y", "VIX", "VIX3M", "VIX9D", "WTI",
               "XAUUSD", "USDTHB", "TICK", "NDX", "SPX", "MOVE"}
MACRO_ROW_ORDER = ["SPY", "NDX", "IWM", "VIX", "VIX9D", "VIX3M", "US10", "US10Y",
                   "DXY", "USDTHB", "XAUUSD", "WTI", "BTCUSDT", "HYG", "TICK"]
ETF_KNOWN = {"SMH", "SOXX", "IGV", "SKYY", "BOTZ", "ROBO", "PAVE", "FIW", "UFO",
             "CIBR", "XBI", "XLF", "XLU", "XLV", "XLK", "XLI", "XLE", "XLRE",
             "COPX", "LQD", "IYT", "XHB", "XME", "ITA", "IWM", "SPY", "QQQ", "HYG"}
TRIPWIRES = {"US10Y": 4.55, "DXY_BREAKOUT": 101.8, "DXY_REJECT": 100.0, "WTI": 72.0}


# ---------------------------------------------------------------- loading ----

def newest_parts(csv_dir: str, tf: str) -> list[str]:
    """Pick the newest part1+part2 per timeframe (handles '(N)' suffix copies)."""
    out = []
    for part in ("part1", "part2"):
        cands = glob.glob(os.path.join(csv_dir, f"ztrade_export_{tf}_{part}*.csv"))
        if cands:
            out.append(max(cands, key=os.path.getmtime))
    return out


def newest_formula(csv_dir: str) -> str | None:
    cands = glob.glob(os.path.join(csv_dir, "ztrade_formula*.csv"))
    return max(cands, key=os.path.getmtime) if cands else None


def fingerprint(paths: list[str]) -> str:
    """CONTENT hash with normalized names: a re-uploaded duplicate like
    'ztrade_export_1d_part1(9).csv' (new name+mtime, same bytes) yields the
    same fingerprint, so auto mode correctly reuses the saved snapshot."""
    h = hashlib.sha1()
    for p in sorted(paths, key=lambda x: re.sub(r"\(\d+\)", "", os.path.basename(x))):
        h.update(re.sub(r"\(\d+\)", "", os.path.basename(p)).encode())
        with open(p, "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:16]


def clean_csv(csv_dir: str) -> list[str]:
    """Delete superseded ztrade csv copies; keep the newest (mtime) per
    normalized name (tf/part + formula). Returns removed basenames."""
    removed, groups = [], {}
    for p in glob.glob(os.path.join(csv_dir, "ztrade_*.csv")):
        groups.setdefault(re.sub(r"\(\d+\)", "", os.path.basename(p)), []).append(p)
    for ps in groups.values():
        keep = max(ps, key=os.path.getmtime)
        for p in ps:
            if p != keep:
                os.remove(p)
                removed.append(os.path.basename(p))
    return removed


def clean_history(base: str, keep: int = 10) -> list[str]:
    """Delete oldest snapshots, keep the newest `keep`. Returns removed names."""
    import shutil
    removed = []
    snaps = list_snapshots(base)
    for s in (snaps[:-keep] if keep > 0 else snaps):
        shutil.rmtree(os.path.join(base, s))
        removed.append(s)
    latest = os.path.join(base, "LATEST")
    if snaps and keep > 0:
        with open(latest, "w") as f:
            f.write(snaps[-1])
    elif os.path.exists(latest):
        os.remove(latest)
    return removed


def read_meta(path: str) -> dict:
    meta = {}
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            # tolerate a comment line that a buggy exporter csv-quoted, so it
            # begins with '"#' instead of '#'
            probe = line.lstrip('"')
            if not probe.startswith("#"):
                break
            m = re.match(r"#\s*([\w]+):\s*(.+)", probe)
            if m:
                meta[m.group(1)] = m.group(2).rstrip('"').strip()
    return meta


def _read_export(path: str) -> pd.DataFrame:
    """Read one export csv, skipping metadata even when a comment line was
    csv-quoted (starts with '\"#') — pandas comment='#' misses those."""
    with open(path, encoding="utf-8-sig") as fh:
        lines = [ln for ln in fh if not ln.lstrip('"').startswith("#")]
    return pd.read_csv(io.StringIO("".join(lines)))


def load_exports(csv_dir: str) -> tuple[dict, dict, list[str]]:
    """Return ({tf: df}, meta, file_list). Missing timeframes are skipped."""
    tfs, files = {}, []
    meta = {}
    for tf in TFS:
        parts = newest_parts(csv_dir, tf)
        if not parts:
            continue
        files += parts
        if not meta:
            meta = read_meta(parts[0])
        d = pd.concat([_read_export(p) for p in parts], ignore_index=True)
        d["Datetime"] = pd.to_datetime(d["Datetime"], format="mixed")
        tfs[tf] = d.sort_values(["Symbol", "Datetime"]).reset_index(drop=True)
    return tfs, meta, files


def load_news(csv_dir: str) -> list[str]:
    path = newest_formula(csv_dir)
    if not path:
        return []
    rows = pd.read_csv(path, encoding="utf-8-sig")
    news = rows[rows.Section == "LATEST_FINANCIAL_NEWS"]
    out = []
    for _, r in news.iterrows():
        if "Source" in str(r.Key):
            continue
        title = str(r.Value).rsplit(", http", 1)[0]
        # strip a leading RFC-2822 or ISO date stamp
        title = re.sub(r"^(\w{3}, )?\d{1,2} \w{3} \d{4} [\d:]+ ([+\-]\d{4}|GMT|UTC|\w{3}),\s*", "", title)
        title = re.sub(r"^\d{4}-\d{2}-\d{2} [\d:]+,\s*", "", title)
        src = r.Key if pd.notna(r.Key) else (r.Subsection if pd.notna(r.Subsection) else "")
        out.append(f"[{src}] {title}")
    return out


# --------------------------------------------- tz normalization + sanity ----

def detect_et_offset(tfs: dict) -> int:
    """Old exports (tz bug) stamp bars at trueET-7h. Detect from the modal
    time-of-day of 1d bars: correct exports stamp daily bars at 09:30 ET."""
    if "1d" not in tfs:
        return 0
    d = tfs["1d"]
    tod = d.Datetime.dt.hour * 60 + d.Datetime.dt.minute
    modal = tod.mode().iloc[0]
    offset_min = (9 * 60 + 30) - modal
    # snap to whole hours ±30m; anything weird -> assume already correct
    hours = round(offset_min / 60)
    return hours if abs(offset_min - hours * 60) <= 31 and hours != 0 else 0


def normalize_et(tfs: dict) -> tuple[dict, int]:
    off = detect_et_offset(tfs)
    if off:
        for tf in tfs:
            tfs[tf]["Datetime"] = tfs[tf]["Datetime"] + pd.Timedelta(hours=off)
    return tfs, off


def infer_asof(tfs: dict, meta: dict) -> pd.Timestamp:
    """as-of in ET. Prefer export header; fall back to newest bar end."""
    if meta.get("data_asof_et"):
        try:
            return pd.Timestamp(meta["data_asof_et"]).tz_localize(None)
        except Exception:
            pass
    ends = [tfs[tf].Datetime.max() + pd.Timedelta(hours=BAR_HOURS[tf]) for tf in tfs]
    return max(ends)


def classify_universe(tfs: dict) -> dict:
    syms = set()
    for d in tfs.values():
        syms |= set(d.Symbol.unique())
    noneq = {s for s in syms if s in NONEQ_KNOWN}
    # zero-volume series are index-like even if not in the known list
    if "1d" in tfs:
        vol = tfs["1d"].groupby("Symbol").Volume.sum()
        noneq |= set(vol[vol <= 0].index)
    etfs = {s for s in syms - noneq if s in ETF_KNOWN} - {"SPY"}
    stocks = syms - noneq - etfs - {"SPY"}
    return {"all": sorted(syms), "noneq": sorted(noneq), "etfs": sorted(etfs),
            "stocks": sorted(stocks)}


def sanity_checks(tfs: dict, meta: dict, off: int) -> list[str]:
    notes = []
    if off:
        notes.append(f"tz-shift detected: stamps were ET-{off}h (old exporter bug) -> corrected +{off}h")
    else:
        notes.append("timestamps already ET-correct (fixed exporter)")
    for tf, d in tfs.items():
        bad = d[(d.CMF > 1) | (d.CMF < -1)]
        if len(bad):
            notes.append(f"{tf}: CMF out of [-1,1] on {bad.Symbol.nunique()} symbols -> recompute required")
    if "1d" in tfs:
        d1 = tfs["1d"]
        # oscillators/rate indices swing through zero (TICK ±1000, yields) — ratio
        # jumps there are normal, not splits; only flag real price series.
        NO_SPLIT = {"TICK", "US10Y", "US10", "VIX", "VIX9D", "VIX3M", "MOVE"}
        jump_syms = []
        for sym, g in d1.groupby("Symbol"):
            if sym in NO_SPLIT:
                continue
            r = (g.Close / g.Close.shift(1)).dropna()
            jumps = r[(r > 1.8) | (r < 0.55)]
            if len(jumps):
                i = jumps.index[-1]
                jump_syms.append(f"{sym} {g.loc[i, 'Datetime'].date()} x{r[i]:.2f}")
        if jump_syms:
            notes.append("price jumps (check split vs data error vs real vol event): "
                         + "; ".join(jump_syms[:8]) + ("..." if len(jump_syms) > 8 else ""))
    sizes = {tf: d.Symbol.nunique() for tf, d in tfs.items()}
    if len(set(sizes.values())) > 1:
        notes.append(f"symbol counts differ across TFs: {sizes}")
    missing = [tf for tf in TFS if tf not in tfs]
    if missing:
        notes.append(f"missing timeframes: {missing} (confluence depth limited)")
    return notes


# ------------------------------------------------------------- indicators ----

def cmf_series(df: pd.DataFrame, n: int = 20) -> np.ndarray:
    hl = df.High - df.Low
    mfm = np.where(hl <= 0, 0, ((df.Close - df.Low) - (df.High - df.Close)) / hl)
    mfv = mfm * df.Volume
    return (pd.Series(mfv, index=df.index).rolling(n).sum()
            / df.Volume.rolling(n).sum()).values


def prep_frames(tfs: dict, uni: dict, asof: pd.Timestamp) -> dict:
    """Per TF: drop forming bars, tag usable (RTH for equities) bars, and
    recompute flow columns per symbol. Returns {tf: {sym: df}}."""
    out = {}
    for tf, d in tfs.items():
        d = d.copy()
        if tf in ("1h", "4h"):
            # forming-bar cut by wall clock (intraday stamps are reliable)
            d = d[d.Datetime + pd.Timedelta(hours=BAR_HOURS[tf]) <= asof]
        if "Is_Closed_Bar" in d:
            d = d[d.Is_Closed_Bar != False]  # noqa: E712
        hr = d.Datetime.dt.hour + d.Datetime.dt.minute / 60
        if tf == "1h":
            eq_rth = (hr >= 9.0) & (hr < 16.0)   # 09:00 straddle bar carries the open
            use = eq_rth | d.Symbol.isin(uni["noneq"])
        elif tf == "4h":
            eq_rth = (hr >= 8.0) & (hr < 16.0)   # 4H grid: 08:30 + 12:30 cover RTH
            use = eq_rth | d.Symbol.isin(uni["noneq"])
        else:
            use = pd.Series(True, index=d.index)
        d = d[use]
        per = {}
        for s, g in d.groupby("Symbol"):
            g = g.sort_values("Datetime").reset_index(drop=True)
            if g.Volume.fillna(0).sum() > 0:
                # file CMF(50) is the system CMF (trusted when in bounds);
                # cmf20 is the fast recomputed flow read
                bad = (g.CMF.abs() > 1).any() if "CMF" in g else True
                if bad:
                    g["CMF"] = cmf_series(g, 50)
                g["cmf20"] = cmf_series(g, 20)
                obv = (np.sign(g.Close.diff().fillna(0)) * g.Volume).cumsum()
                slope = obv.diff()
                sd = slope.rolling(50, min_periods=20).std()
                g["obv_slope"] = slope
                g["obv_norm"] = (slope / sd).clip(-1, 1)
                # formula-file spec: RVOL = V/SMA(V,20). Time-of-day RVOL only
                # for intraday TFs (exporter Rvol_Tod); 1D/1W always raw SMA20
                # so holiday scaling is applied exactly once (by ipi_last).
                if tf in ("1h", "4h") and "Rvol_Tod" in g and g.Rvol_Tod.notna().any():
                    g["rvol"] = g.Rvol_Tod
                else:
                    g["rvol"] = g.Volume / g.Volume.rolling(20, min_periods=10).mean()
            else:
                for c in ("cmf20", "obv_slope", "obv_norm", "rvol"):
                    g[c] = np.nan
                g["CMF"] = np.nan
            per[s] = g
        out[tf] = per
    return out


def week_scale(tfs_raw: dict, week_start: pd.Timestamp, uni: dict) -> float:
    """5/(US trading days in that week) from the 1d file — holiday-week RVOL fix.
    Count only equity symbols: crypto/fx trade weekends and would mask holidays."""
    if "1d" not in tfs_raw:
        return 1.0
    d = tfs_raw["1d"]
    eq = d[~d.Symbol.isin(uni["noneq"])]
    ref = eq[eq.Symbol == "SPY"] if (eq.Symbol == "SPY").any() else eq
    days = ref[(ref.Datetime >= week_start) & (ref.Datetime < week_start + pd.Timedelta(days=7))]
    n = days.groupby(days.Datetime.dt.date).ngroups
    return 5.0 / n if 0 < n < 5 else 1.0


def ipi_last(g: pd.DataFrame, rvol_scale: float = 1.0) -> dict:
    """IPI of the last usable bar: CMF*100 + RVOL_dev*0.5 + obv_norm*50."""
    if g is None or not len(g) or pd.isna(g.CMF.iloc[-1]):
        return {"ipi": None, "status": "no-vol"}
    r = g.iloc[-1]
    rvol = (r.rvol if pd.notna(r.rvol) else 1.0) * rvol_scale
    ipi = r.CMF * 100 + (rvol - 1) * 100 * 0.5 + (r.obv_norm if pd.notna(r.obv_norm) else 0) * 50
    if rvol < 0.3:
        status = "N/A (low vol)"
    elif ipi > 50:
        status = "Accum"
    elif ipi < -20:
        status = "Dist"
    else:
        status = "Neut"
    return {"ipi": round(float(ipi), 1), "status": status, "cmf": round(float(r.CMF), 3),
            "cmf20": round(float(r.cmf20), 3) if pd.notna(r.cmf20) else None,
            "rvol": round(float(rvol), 2)}


# ------------------------------------------------------------ assessments ----

def gc(row) -> bool:
    try:
        return bool(row.Close > row.EMA_50 and row.EMA_50 > row.EMA_200)
    except Exception:
        return False


def last_row(frames, tf, s):
    g = frames.get(tf, {}).get(s)
    return (g, g.iloc[-1]) if g is not None and len(g) else (None, None)


def symbol_view(frames, s, wscale) -> dict:
    """Everything the screen needs for one symbol, one dict."""
    v = {"sym": s}
    for tf in TFS:
        g, r = last_row(frames, tf, s)
        if r is None:
            continue
        scale = wscale if tf == "1w" else 1.0
        ip = ipi_last(g, scale)
        v[tf] = {"close": round(float(r.Close), 2), "gc": gc(r),
                 "c_gt_e20": bool(r.Close > r.EMA_20), "c_gt_e50": bool(r.Close > r.EMA_50),
                 "c_gt_e200": bool(r.Close > r.EMA_200),
                 "rsi": round(float(r.RSI), 0) if pd.notna(r.RSI) else None,
                 "e20": round(float(r.EMA_20), 2), "e50": round(float(r.EMA_50), 2),
                 "e200": round(float(r.EMA_200), 2),
                 "vwap": round(float(r.VWAP), 2) if pd.notna(r.VWAP) else None,
                 "atr": round(float(r.Atr14), 2) if "Atr14" in r and pd.notna(r.Atr14) else None,
                 "dvol_m": round(float(r.Dollar_Volume) / 1e6, 0) if "Dollar_Volume" in r and pd.notna(r.Dollar_Volume) else None,
                 **ip}
    return v


def uipt_stage_short(v: dict, frames) -> dict:
    """UIPT-S staging for 1H+4H only sets (no 1D/1W). 4H is the structure gate
    (Golden Cross + flow) in place of the weekly macro filter, 1H is the trigger.
    Explicitly labelled short-only so it's never mistaken for the full 4-phase
    UIPT that requires the weekly Kill Switch."""
    h4, h1 = v.get("4h"), v.get("1h")
    if not h4:
        return {"stage": "NO-DATA", "mode": "short"}
    kill4 = h4["status"] == "Dist"
    gc4 = h4["gc"]
    struct = gc4 and (h4.get("cmf") or 0) > 0 and not kill4          # 4H structure ok
    near_ema = h4["close"] <= h4["e20"] * 1.02 or h4["close"] <= h4["e50"] * 1.02
    rsi_ok = (h4["rsi"] and 40 <= h4["rsi"] <= 68)
    setup = struct and near_ema and h4["c_gt_e200"] and rsi_ok
    p4 = False
    if h1:
        g = frames.get("1h", {}).get(v["sym"])
        obv_up = g is not None and len(g) >= 2 and (g.obv_slope.iloc[-1] or 0) > 0
        p4 = (h1["vwap"] and h1["close"] > h1["vwap"] and (h1["rvol"] or 0) > 1.5
              and obv_up and h1["status"] == "Accum")
    if kill4:
        stage = "KILL-S"
    elif struct and setup and p4:
        stage = "TRIGGER-S"
    elif struct and setup:
        stage = "SETUP-S"
    elif struct:
        stage = "WATCH-S"
    else:
        stage = "FAIL-S"
    ext200 = round((h4["close"] / h4["e200"] - 1) * 100, 0) if h4["e200"] else None
    return {"stage": stage, "mode": "short", "kill": kill4, "gc4": gc4,
            "struct": struct, "setup": setup, "p4": p4, "trap6": False,
            "ext200_pct": ext200}


def uipt_stage(v: dict, frames, mode: str = "full") -> dict:
    """4-phase UIPT staging + kill switch + rule-6 trap check for one symbol.
    mode='short' (whole dataset lacks 1D/1W) -> UIPT-S. In full mode a single
    symbol missing its 1D/1W bars is NO-DATA, NOT silently downgraded to -S
    (that would mix short stages into a medium screen)."""
    d1, w1, h4, h1 = v.get("1d"), v.get("1w"), v.get("4h"), v.get("1h")
    if mode == "short":
        return uipt_stage_short(v, frames)
    if not d1 or not w1:
        return {"stage": "NO-DATA", "reason": "missing 1D/1W bars for this symbol"}
    kill = d1["status"] == "Dist" or w1["status"] == "Dist"
    p2 = d1["gc"] and w1["gc"] and (w1["cmf"] or 0) > 0 and w1["status"] == "Accum" and not kill
    p2_loose = d1["gc"] and w1["gc"] and (w1["cmf"] or 0) > 0 and not kill
    near_ema = d1["close"] <= d1["e20"] * 1.02 or d1["close"] <= d1["e50"] * 1.02
    rsi_ok = (d1["rsi"] and 40 <= d1["rsi"] <= 60) or (h4 and h4["rsi"] and 40 <= h4["rsi"] <= 60)
    p3 = near_ema and d1["c_gt_e200"] and rsi_ok and (d1["cmf"] or 0) > 0
    p4 = False
    if h1:
        g = frames.get("1h", {}).get(v["sym"])
        obv_up = g is not None and len(g) >= 2 and (g.obv_slope.iloc[-1] or 0) > 0
        p4 = (h1["vwap"] and h1["close"] > h1["vwap"] and (h1["rvol"] or 0) > 1.5
              and obv_up and h1["status"] == "Accum")
    if kill:
        stage = "KILL"
    elif p2 and p3 and p4:
        stage = "TRIGGER"
    elif p2 and p3:
        stage = "SETUP"
    elif p2:
        stage = "MACRO-WATCH"
    elif p2_loose and p3:
        stage = "SETUP(loose)"
    elif p2_loose:
        stage = "WATCH(loose)"
    else:
        stage = "FAIL"
    # rule-6 trap: latest Dist preceded by Accum w/ rvol>1.2 and CMF still > 0
    trap = False
    g = frames.get("1h", {}).get(v["sym"])
    if g is not None and len(g) >= 10 and h1 and h1["status"] == "Dist" and (h1["cmf"] or 0) > 0:
        prior = g.iloc[-6:-1]
        pri_ipi = [ipi_last(g.iloc[:i + 1]) for i in range(len(g) - 6, len(g) - 1)]
        trap = any(p["status"] == "Accum" and (prior.rvol.iloc[j] or 0) > 1.2
                   for j, p in enumerate(pri_ipi))
    ext200 = round((d1["close"] / d1["e200"] - 1) * 100, 0) if d1["e200"] else None
    return {"stage": stage, "kill": kill, "p2": p2, "p2_loose": p2_loose, "p3": p3,
            "p4": p4, "trap6": trap, "ext200_pct": ext200}


def coil_view(frames, s) -> dict | None:
    # prefer the daily base; fall back to 4H when 1D is absent (short-only sets)
    dd = frames.get("1d", {}).get(s)
    if dd is None or len(dd) < 25:
        dd = frames.get("4h", {}).get(s)
    hd = frames.get("1h", {}).get(s)
    if dd is None or hd is None or len(dd) < 20:
        return None
    piv = float(dd.High.tail(15).max())
    px = float(hd.Close.iloc[-1])
    atr5 = float((dd.High - dd.Low).tail(5).mean())
    atr20 = float((dd.High - dd.Low).tail(20).mean())
    atr14 = float(dd.Atr14.iloc[-1]) if "Atr14" in dd and pd.notna(dd.Atr14.iloc[-1]) else atr20
    ign = bool(((hd.tail(15).rvol > 1.2) & (hd.tail(15).cmf20 > 0)).any())
    ext_atr = (px - piv) / atr14 if px > piv else 0
    tag = "EXTENDED" if ext_atr > 1.5 else ("NEAR-PIVOT" if piv * 0.98 <= px <= piv * 1.005 else "")
    if not tag and not (atr5 < atr20 and ign):
        return None
    return {"pivot15d": round(piv, 2), "dist_pct": round((px / piv - 1) * 100, 1),
            "contracting": atr5 < atr20, "ignition": ign, "tag": tag or "COILING"}


def levels_view(frames, s) -> dict | None:
    dd = frames.get("1d", {}).get(s)
    base_tf = "1d"
    if dd is None or not len(dd):
        dd = frames.get("4h", {}).get(s)  # short-only: use 4H for structure levels
        base_tf = "4h"
    hd = frames.get("1h", {}).get(s)
    if dd is None or not len(dd):
        return None
    r = dd.iloc[-1]
    out = {"base_tf": base_tf,
           "swing_hi15": round(float(dd.High.tail(15).max()), 2),
           "swing_lo10": round(float(dd.Low.tail(10).min()), 2),
           "e20d": round(float(r.EMA_20), 2), "e50d": round(float(r.EMA_50), 2),
           "e200d": round(float(r.EMA_200), 2),
           "atr14d": round(float(r.Atr14), 2) if "Atr14" in r and pd.notna(r.Atr14) else None}
    if hd is not None and len(hd):
        out["e20_1h"] = round(float(hd.EMA_20.iloc[-1]), 2)
        out["vwap_1h"] = round(float(hd.VWAP.iloc[-1]), 2) if pd.notna(hd.VWAP.iloc[-1]) else None
    return out


# ------------------------------------------------------- regime / sectors ----

def cur_price(tfs_raw: dict, s: str) -> float | None:
    for tf in ("1h", "4h", "1d"):
        if tf in tfs_raw:
            g = tfs_raw[tf][tfs_raw[tf].Symbol == s]
            if len(g):
                return float(g.Close.iloc[-1])
    return None


def regime_view(views: dict, tfs_raw: dict, uni: dict) -> dict:
    out = {"metrics": {}, "breadth": {}, "tripwires": {}}
    px = {s: cur_price(tfs_raw, s) for s in uni["all"]}
    for s in MACRO_ROW_ORDER:
        if s not in views:
            continue
        v = views[s]
        d1, w1 = v.get("1d"), v.get("1w")
        prev = d1["close"] if d1 else None
        out["metrics"][s] = {
            "px": round(px[s], 2) if px.get(s) else None,
            "chg_pct": round((px[s] / prev - 1) * 100, 2) if px.get(s) and prev else None,
            "gc_d": d1["gc"] if d1 else None, "gc_w": w1["gc"] if w1 else None,
            "rsi_d": d1["rsi"] if d1 else None,
            "cmf_d": d1.get("cmf") if d1 else None, "cmf20_d": d1.get("cmf20") if d1 else None,
            "ipi_d": d1.get("status") if d1 else None, "ipi_w": w1.get("status") if w1 else None,
            "above_e200d": d1["c_gt_e200"] if d1 else None,
        }
    scr = uni["stocks"] + uni["etfs"]
    n = len(scr) or 1
    # breadth base TF: daily if present, else 4H (short-only sets). The "kill"
    # count is only meaningful in full mode (weekly Kill Switch); in short mode
    # we surface how many failed the 4H structure gate instead of a macro kill.
    btf = "1d" if any(views.get(s, {}).get("1d") for s in scr) else "4h"
    gc_ct = sum(1 for s in scr if views.get(s, {}).get(btf, {}).get("gc"))
    cmf_pos = sum(1 for s in scr if (views.get(s, {}).get(btf, {}).get("cmf") or 0) > 0)
    cmf20_pos = sum(1 for s in scr if (views.get(s, {}).get(btf, {}).get("cmf20") or 0) > 0)
    if btf == "1d":
        flagged = [s for s in scr if views.get(s, {}).get("_stage", {}).get("kill")]
        kill_label = "kill"
    else:
        flagged = [s for s in scr if (views.get(s, {}).get("_stage", {}).get("stage") in ("FAIL-S", "KILL-S"))]
        kill_label = "4H-fail"
    out["breadth"] = {"n": n, "base_tf": btf, "gc_d_pct": round(gc_ct / n * 100),
                      "cmf50_pos_pct": round(cmf_pos / n * 100),
                      "cmf20_pos_pct": round(cmf20_pos / n * 100),
                      "kill_count": len(flagged), "kill_label": kill_label,
                      "kill_list": flagged}
    if px.get("US10Y"):
        out["tripwires"]["US10Y->4.55"] = f"{px['US10Y']:.2f} ({(px['US10Y']/TRIPWIRES['US10Y']-1)*100:+.1f}%)"
    if px.get("DXY"):
        out["tripwires"]["DXY->101.8/100.0"] = f"{px['DXY']:.2f} ({(px['DXY']/TRIPWIRES['DXY_BREAKOUT']-1)*100:+.1f}% / {(px['DXY']/TRIPWIRES['DXY_REJECT']-1)*100:+.1f}%)"
    if px.get("WTI"):
        out["tripwires"]["WTI->72"] = f"{px['WTI']:.2f} ({(px['WTI']/TRIPWIRES['WTI']-1)*100:+.1f}%)"
    if px.get("VIX") and px.get("VIX3M"):
        out["tripwires"]["VIX/VIX3M"] = f"{px['VIX']/px['VIX3M']:.2f} ({'backwardation!' if px['VIX']>px['VIX3M'] else 'contango'})"
    if px.get("VIX") and px.get("VIX9D"):
        out["tripwires"]["VIX9D/VIX"] = f"{px['VIX9D']/px['VIX']:.2f}"
    hyg = views.get("HYG", {}).get("1d")
    if hyg:
        out["tripwires"]["HYG_vs_E200D"] = f"{hyg['close']} vs {hyg['e200']} ({'BELOW!' if not hyg['c_gt_e200'] else 'above'})"
    # crude permission suggestion (Claude makes the final call in the report)
    near_trip = any(abs(px.get(k2, 0) / t - 1) < 0.01 for k2, t in
                    [("US10Y", TRIPWIRES["US10Y"]), ("DXY", TRIPWIRES["DXY_BREAKOUT"]), ("WTI", TRIPWIRES["WTI"])]
                    if px.get(k2))
    fired = (px.get("US10Y", 0) > TRIPWIRES["US10Y"] or px.get("WTI", 0) > TRIPWIRES["WTI"]
             or (px.get("VIX", 0) > px.get("VIX3M", 9e9)))
    hyg_below = bool(hyg and not hyg["c_gt_e200"])
    if fired:
        out["permission_hint"] = "RISK-OFF (tripwire fired)"
    elif near_trip or hyg_below:
        reasons = []
        if near_trip:
            reasons.append("within 1% of a tripwire")
        if hyg_below:
            reasons.append("HYG below EMA200D")
        out["permission_hint"] = f"TRANSITION ({' / '.join(reasons)})"
    elif out["breadth"]["cmf50_pos_pct"] < 50:
        out["permission_hint"] = "SELECTIVE (breadth <50%)"
    else:
        out["permission_hint"] = "RISK-ON candidate (verify manually)"
    return out


def sector_map(views: dict, frames: dict, uni: dict) -> list[dict]:
    spy = frames.get("1d", {}).get("SPY")
    rows = []
    for s in uni["etfs"] + (["HYG"] if "HYG" in views and "HYG" not in uni["etfs"] else []):
        v = views.get(s, {})
        row = {"sym": s}
        for tf in TFS:
            row[f"cmf20_{tf}"] = v.get(tf, {}).get("cmf20")
        d1 = v.get("1d", {})
        row.update({"ipi_d": d1.get("status"), "ipi_w": v.get("1w", {}).get("status"),
                    "gc_d": d1.get("gc"), "rsi_d": d1.get("rsi")})
        g = frames.get("1d", {}).get(s)
        if spy is not None and g is not None:
            for days, key in ((20, "rs20"), (60, "rs60")):
                if len(g) > days and len(spy) > days:
                    row[key] = round(((g.Close.iloc[-1] / g.Close.iloc[-1 - days] - 1)
                                      - (spy.Close.iloc[-1] / spy.Close.iloc[-1 - days] - 1)) * 100, 1)
        rows.append(row)
    rows.sort(key=lambda r: r.get("rs20") or -99, reverse=True)
    return rows


# --------------------------------------------------------------- portfolio ----

def parse_port(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    pos = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        m = re.match(r"([A-Z]{1,6})\s*\(.*ต้นทุนต่อหุ้น:\s*\$([\d,.]+).*จำนวนหุ้น:\s*([\d.]+)", line)
        if m:
            pos.append({"sym": m.group(1), "cost": float(m.group(2).replace(",", "")),
                        "shares": float(m.group(3)), "book": "main"})
            continue
        m = re.search(r"\b([A-Z]{2,6})\s+(\d+)\s*/\s*\$?([\d,.]+)\s*$", line)
        if m and m.group(1) not in ("USD", "THB"):
            pos.append({"sym": m.group(1), "cost": float(m.group(3).replace(",", "")),
                        "shares": float(m.group(2)), "book": "swing"})
            continue
        m = re.search(r"([A-Z]{2,6})\s+(\d+)\s+\$([\d,.]+)", line)
        if m:
            pos.append({"sym": m.group(1), "cost": float(m.group(3).replace(",", "")),
                        "shares": float(m.group(2)), "book": "swing"})
    return pos


def portfolio_marks(port: list[dict], tfs_raw: dict, views: dict) -> list[dict]:
    out = []
    for p in port:
        px = cur_price(tfs_raw, p["sym"])
        row = dict(p)
        if px:
            row.update({"px": round(px, 2), "pl_usd": round((px - p["cost"]) * p["shares"]),
                        "pl_pct": round((px / p["cost"] - 1) * 100, 1),
                        "stage": views.get(p["sym"], {}).get("_stage", {}).get("stage")})
        else:
            row["px"] = None
            row["note"] = "not in export"
        out.append(row)
    return out


# ------------------------------------------------------------------ digest ----

def fmt(x, spec=""):
    return "na" if x is None else format(x, spec)


def build_digest(state: dict) -> str:
    L = []
    A = L.append
    mode = state.get("screen_mode", "full")
    present = "+".join(state.get("tfs_present", []))
    A(f"# Radar digest — as-of {state['asof_et']} ET | fingerprint {state['fingerprint']}")
    A(f"market_state(header)={state['meta'].get('market_state','?')} | files={len(state['files'])} "
      f"(newest mtime {state.get('csv_newest_mtime','?')}) | universe={len(state['universe']['all'])}")
    A(f"**screen_mode: {mode.upper()}** — timeframes present: {present}")
    if mode == "short":
        A("> SHORT mode (no 1D/1W): staging is **UIPT-S** — 4H is the structure gate "
          "(GC+flow) in place of the weekly Kill Switch, 1H is the trigger. Stages end in "
          "`-S`. This is NOT the full 4-phase UIPT; do not issue medium/position calls. "
          "Regime metrics that need 1D/1W show `na` — read the intraday flow instead.")
    A("\n## Data health")
    for n in state["sanity"]:
        A(f"- {n}")
    A("\n## Layer-0 regime")
    A(f"permission_hint: **{state['regime']['permission_hint']}**")
    for k, v in state["regime"]["tripwires"].items():
        A(f"- {k}: {v}")
    b = state["regime"]["breadth"]
    btf = b.get("base_tf", "1d").upper()
    kl = b.get("kill_label", "kill")
    A(f"- breadth ({btf}): GC {b['gc_d_pct']}% | CMF50>0 {b['cmf50_pos_pct']}% | CMF20>0 {b['cmf20_pos_pct']}% | {kl} {b['kill_count']}/{b['n']}: {','.join(b['kill_list'][:40])}{'...' if len(b['kill_list'])>40 else ''}")
    A("\n|macro|px|chg%|GC d/w|RSI|CMF50/20|IPI d/w|")
    A("|--|--|--|--|--|--|--|")
    for s, m in state["regime"]["metrics"].items():
        A(f"|{s}|{fmt(m['px'])}|{fmt(m['chg_pct'])}|{int(bool(m['gc_d']))}/{int(bool(m['gc_w']))}|{fmt(m['rsi_d'])}|{fmt(m['cmf_d'])}/{fmt(m['cmf20_d'])}|{m['ipi_d']}/{m['ipi_w']}|")
    A("\n## Sector flow (sorted by RS20)")
    A("|etf|cmf20 1h/4h/1d/1w|IPI d/w|RS20|RS60|GCd|RSI|")
    A("|--|--|--|--|--|--|--|")
    for r in state["sectors"]:
        c = "/".join(fmt(r.get(f"cmf20_{tf}"), "+.2f") if r.get(f"cmf20_{tf}") is not None else "na" for tf in ["1h", "4h", "1d", "1w"])
        A(f"|{r['sym']}|{c}|{r.get('ipi_d')}/{r.get('ipi_w')}|{fmt(r.get('rs20'))}|{fmt(r.get('rs60'))}|{int(bool(r.get('gc_d')))}|{fmt(r.get('rsi_d'))}|")
    if mode == "short":
        A("\n## UIPT-S staging (stocks + ETFs) — 4H structure gate + 1H trigger")
        A("|sym|stage|px_now|4H close|4H gc|4H cmf/cmf20/IPI/RSI|1H cmf20/IPI/rvol|ext200(4H)%|coil|")
        A("|--|--|--|--|--|--|--|--|--|")
        # rank so actionable names float up: TRIGGER-S > SETUP-S > WATCH-S > rest
        order = {"TRIGGER-S": 0, "SETUP-S": 1, "WATCH-S": 2, "FAIL-S": 3, "KILL-S": 4, "NO-DATA": 5}
        names = state["universe"]["stocks"] + state["universe"]["etfs"]
        names.sort(key=lambda s: order.get((state["views"].get(s, {}).get("_stage") or {}).get("stage"), 9))
        for s in names:
            v = state["views"].get(s)
            if not v:
                continue
            st = v.get("_stage", {})
            h4, h1 = v.get("4h", {}), v.get("1h", {})
            coil = v.get("_coil")
            coil_s = f"{coil['tag']} piv={coil['pivot15d']} ({coil['dist_pct']:+.1f}%)" if coil else ""
            A(f"|{s}|{st.get('stage')}|{fmt(round(v['px_now'], 2) if v.get('px_now') else None)}|"
              f"{fmt(h4.get('close'))}|{'Y' if h4.get('gc') else ''}|"
              f"{fmt(h4.get('cmf'))}/{fmt(h4.get('cmf20'))}/{h4.get('status')}/{fmt(h4.get('rsi'))}|"
              f"{fmt(h1.get('cmf20'))}/{h1.get('status')}/{fmt(h1.get('rvol'))}|"
              f"{fmt(st.get('ext200_pct'))}|{coil_s}|")
    else:
        A("\n## UIPT staging (stocks + ETFs) — px_now = live print, close_d = last closed 1D")
        A("|sym|stage|px_now|close_d|1W cmf/IPI|1D cmf/cmf20/IPI/RSI|1H cmf20/IPI/rvol|ext200%|trap6|coil|")
        A("|--|--|--|--|--|--|--|--|--|--|")
        for s in state["universe"]["stocks"] + state["universe"]["etfs"]:
            v = state["views"].get(s)
            if not v:
                continue
            st = v.get("_stage", {})
            d1, w1, h1 = v.get("1d", {}), v.get("1w", {}), v.get("1h", {})
            coil = v.get("_coil")
            coil_s = f"{coil['tag']} piv={coil['pivot15d']} ({coil['dist_pct']:+.1f}%)" if coil else ""
            A(f"|{s}|{st.get('stage')}|{fmt(round(v['px_now'], 2) if v.get('px_now') else None)}|{fmt(d1.get('close'))}|{fmt(w1.get('cmf'))}/{w1.get('status')}|"
              f"{fmt(d1.get('cmf'))}/{fmt(d1.get('cmf20'))}/{d1.get('status')}/{fmt(d1.get('rsi'))}|"
              f"{fmt(h1.get('cmf20'))}/{h1.get('status')}/{fmt(h1.get('rvol'))}|{fmt(st.get('ext200_pct'))}|"
              f"{'Y' if st.get('trap6') else ''}|{coil_s}|")
    lvl_tf = "4H" if mode == "short" else "1D"
    A(f"\n## Levels (non-KILL, non-FAIL names) — structure EMAs from {lvl_tf}")
    A(f"|sym|px_now|1H e20|1H vwap|{lvl_tf} e20|{lvl_tf} e50|{lvl_tf} e200|ATR14|swingHi15|swingLo10|")
    A("|--|--|--|--|--|--|--|--|--|--|")
    _skip = {"KILL", "FAIL", "KILL-S", "FAIL-S", "NO-DATA", None}
    for s in state["universe"]["stocks"] + state["universe"]["etfs"]:
        v = state["views"].get(s, {})
        if v.get("_stage", {}).get("stage") in _skip:
            continue
        lv = v.get("_levels") or {}
        A(f"|{s}|{fmt(round(v['px_now'], 2) if v.get('px_now') else None)}|{fmt(lv.get('e20_1h'))}|{fmt(lv.get('vwap_1h'))}|"
          f"{fmt(lv.get('e20d'))}|{fmt(lv.get('e50d'))}|{fmt(lv.get('e200d'))}|{fmt(lv.get('atr14d'))}|"
          f"{fmt(lv.get('swing_hi15'))}|{fmt(lv.get('swing_lo10'))}|")
    if state.get("portfolio"):
        A("\n## Portfolio marks")
        A("|sym|book|shares|cost|px|P&L$|P&L%|stage|")
        A("|--|--|--|--|--|--|--|--|")
        for p in state["portfolio"]:
            A(f"|{p['sym']}|{p['book']}|{p['shares']:g}|{p['cost']}|{fmt(p.get('px'))}|"
              f"{fmt(p.get('pl_usd'))}|{fmt(p.get('pl_pct'))}|{p.get('stage') or p.get('note','')}|")
    if state.get("news"):
        A("\n## News (from formula file — tag horizon×flow in the report)")
        for n_ in state["news"][:25]:
            A(f"- {n_}")
    A("\n> Method: IPI recomputed on corrected-ET RTH closed bars (file IPI_Status ignored). "
      "RVOL: 1H/4H = exporter Rvol_Tod; 1D/1W = V/SMA20 per formula spec, latest week holiday-scaled x{:.2f}. "
      "CMF = file CMF(50) [in-bounds]; cmf20 = fast recomputed flow.".format(state.get("wscale", 1.0)))
    return "\n".join(L)


# ----------------------------------------------------------------- history ----

def run_screen(csv_dir: str, port_path: str | None = None) -> dict:
    tfs_raw, meta, files = load_exports(csv_dir)
    if not tfs_raw:
        raise SystemExit(f"no ztrade_export_*.csv found in {csv_dir}")
    tfs_raw, off = normalize_et(tfs_raw)
    asof = infer_asof(tfs_raw, meta)
    uni = classify_universe(tfs_raw)
    sanity = sanity_checks(tfs_raw, meta, off)
    frames = prep_frames(tfs_raw, uni, asof)
    wk = None
    if "1w" in frames:
        for g in frames["1w"].values():
            if len(g):
                wk = g.Datetime.iloc[-1]
                break
    wscale = week_scale(tfs_raw, wk.normalize() - pd.Timedelta(days=wk.weekday()), uni) if wk is not None else 1.0
    # full = whole dataset has 1D+1W (real 4-phase UIPT); short = only 1H/4H
    screen_mode = "full" if ("1d" in tfs_raw and "1w" in tfs_raw) else "short"
    views = {}
    for s in uni["all"]:
        v = symbol_view(frames, s, wscale)
        v["px_now"] = cur_price(tfs_raw, s)  # live last print (may be a forming bar)
        if s not in uni["noneq"]:
            v["_stage"] = uipt_stage(v, frames, screen_mode)
            v["_coil"] = coil_view(frames, s)
            v["_levels"] = levels_view(frames, s)
        views[s] = v
    regime = regime_view(views, tfs_raw, uni)
    sectors = sector_map(views, frames, uni)
    port = portfolio_marks(parse_port(port_path), tfs_raw, views) if port_path else []
    import datetime as _dt
    newest = max(os.path.getmtime(f) for f in files)
    state = {"asof_et": str(asof), "fingerprint": fingerprint(files),
             "csv_newest_mtime": _dt.datetime.fromtimestamp(newest).strftime("%Y-%m-%d %H:%M"),
             "files": [os.path.basename(f) for f in files], "meta": meta,
             "tz_shift_applied_h": off, "wscale": round(wscale, 3), "universe": uni,
             "tfs_present": sorted(tfs_raw.keys(), key=lambda t: TFS.index(t)),
             "screen_mode": screen_mode,
             "sanity": sanity, "views": views, "regime": regime, "sectors": sectors,
             "portfolio": port, "news": load_news(csv_dir)}
    state["digest"] = build_digest(state)
    return state


def history_dir(base: str, state: dict) -> str:
    stamp = re.sub(r"[: ]", "", state["asof_et"][:16].replace("-", ""))
    return os.path.join(base, f"{stamp}_{state['fingerprint'][:8]}")


def save_history(base: str, state: dict, report_md: str | None = None) -> str:
    d = history_dir(base, state)
    os.makedirs(d, exist_ok=True)
    slim = {k: v for k, v in state.items() if k != "digest"}
    with open(os.path.join(d, "full.json"), "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False, default=str, indent=1)
    with open(os.path.join(d, "digest.md"), "w", encoding="utf-8") as f:
        f.write(state["digest"])
    if report_md:
        with open(os.path.join(d, "report.md"), "w", encoding="utf-8") as f:
            f.write(report_md)
    with open(os.path.join(base, "LATEST"), "w") as f:
        f.write(os.path.basename(d))
    return d


REPORTS_DIRNAME = "reports"


def reports_dir(base: str) -> str:
    d = os.path.join(base, REPORTS_DIRNAME)
    os.makedirs(d, exist_ok=True)
    return d


def save_report(base: str, report_md: str, state: dict | None = None) -> tuple[str, str]:
    """Write the report to TWO places:
      1) history/reports/report_latest.md   — always the newest (overwritten)
      2) history/reports/report_<YYYYMMDD_HHMM>[_<asof>].md — dated archive copy
    The reports/ dir is NEVER touched by clean-csv/clean-history/clean-all, so
    every analysis survives a clean-all. Also drops report.md into the matching
    snapshot dir if one exists (that copy is disposable)."""
    import datetime as _dt
    rd = reports_dir(base)
    latest = os.path.join(rd, "report_latest.md")
    with open(latest, "w", encoding="utf-8") as f:
        f.write(report_md)
    now = _dt.datetime.now().strftime("%Y%m%d_%H%M")
    asof = ""
    if state and state.get("asof_et"):
        asof = "_asof" + re.sub(r"[^0-9]", "", str(state["asof_et"])[:16])
    dated = os.path.join(rd, f"report_{now}{asof}.md")
    with open(dated, "w", encoding="utf-8") as f:
        f.write(report_md)
    # disposable copy inside the snapshot dir (gets cleaned with history)
    snap = None
    if state:
        snap = history_dir(base, state)
        if os.path.isdir(snap):
            with open(os.path.join(snap, "report.md"), "w", encoding="utf-8") as f:
                f.write(report_md)
    # wipe-proof copy: stamp the dated report into report_archive/ NOW, not only
    # at --clear-all time, so a history/ wipe can never lose an analysis
    try:
        import shutil as _sh
        arc = os.path.join(_archive_root(base, REPORT_ARCHIVE_DIRNAME),
                           archive_stamp(base, os.path.basename(snap) if snap else None))
        os.makedirs(arc, exist_ok=True)
        _sh.copy2(dated, os.path.join(arc, os.path.basename(dated)))
    except OSError:
        pass  # archiving must never block the save itself
    return latest, dated


def list_reports(base: str) -> list[str]:
    rd = os.path.join(base, REPORTS_DIRNAME)
    if not os.path.isdir(rd):
        return []
    return sorted(f for f in os.listdir(rd)
                  if f.startswith("report_") and f != "report_latest.md")


# ── Legacy archive ──────────────────────────────────────────────────────────
# clear-all is destructive on the WORKING dirs (csv/ + history/), but every set
# is first STAMPED into a permanent legacy archive that clear-all never touches.
# Layout (siblings of the project working dirs, so a history/ wipe can't hit them):
#   csv_archive/<stamp>/         ← copy of the csv set that produced the snapshot
#   report_archive/<stamp>/      ← digest.md + report.md + full.json (if present)
# <stamp> = <asof12>_<fp8> when available (matches the snapshot dir name), else
# the wall-clock time — so archived sets sort chronologically and never collide.
CSV_ARCHIVE_DIRNAME = "csv_archive"
REPORT_ARCHIVE_DIRNAME = "report_archive"


def _archive_root(base: str, dirname: str) -> str:
    # base is the history/ dir; archives live next to it under the project root.
    return os.path.join(os.path.dirname(os.path.abspath(base)) or ".", dirname)


def archive_stamp(base: str, snap: str | None = None) -> str:
    """A collision-free, chronologically-sortable stamp for one archived set.
    Prefer the snapshot dir name (<asof>_<fp>); else fall back to now()."""
    import datetime as _dt
    if snap and re.match(r"\d{12}", snap):
        return snap
    return _dt.datetime.now().strftime("%Y%m%d%H%M") + "_manual"


def archive_set(base: str, csv_dir: str, snap: str | None = None,
                report_md: str | None = None) -> dict:
    """STAMP the current working set into the permanent legacy archive.
    Copies (never moves) so the caller can still delete the originals after.
    Returns {stamp, csv_archive, report_archive, n_csv, kinds}."""
    import shutil
    if snap is None:
        snap = latest_snapshot(base)
        snap = os.path.basename(snap) if snap else None
    stamp = archive_stamp(base, snap)

    csv_arc = os.path.join(_archive_root(base, CSV_ARCHIVE_DIRNAME), stamp)
    rep_arc = os.path.join(_archive_root(base, REPORT_ARCHIVE_DIRNAME), stamp)
    os.makedirs(csv_arc, exist_ok=True)
    os.makedirs(rep_arc, exist_ok=True)

    n_csv = 0
    if os.path.isdir(csv_dir):
        for f in sorted(glob.glob(os.path.join(csv_dir, "*.csv"))):
            shutil.copy2(f, os.path.join(csv_arc, os.path.basename(f)))
            n_csv += 1

    kinds = []
    snap_dir = os.path.join(base, snap) if snap else None
    for fn in ("digest.md", "report.md", "full.json"):
        src = os.path.join(snap_dir, fn) if snap_dir else None
        if src and os.path.exists(src):
            shutil.copy2(src, os.path.join(rep_arc, fn))
            kinds.append(fn)
    # also fold in the newest dated report from reports/ if the snapshot lacked one
    if "report.md" not in kinds:
        reps = list_reports(base)
        if reps:
            shutil.copy2(os.path.join(base, REPORTS_DIRNAME, reps[-1]),
                         os.path.join(rep_arc, "report.md"))
            kinds.append("report.md(from reports/)")
    # a tiny manifest so the archive is self-describing when read back later
    with open(os.path.join(rep_arc, "MANIFEST.txt"), "w", encoding="utf-8") as f:
        f.write(f"stamp={stamp}\nfrom_snapshot={snap}\nn_csv={n_csv}\n"
                f"kinds={','.join(kinds)}\n")
    return {"stamp": stamp, "csv_archive": csv_arc, "report_archive": rep_arc,
            "n_csv": n_csv, "kinds": kinds}


def list_archives(base: str) -> list[dict]:
    """Every legacy set ever stamped, newest last. Reads report_archive/ as the
    index (it always exists once a set is archived). Never recomputes."""
    root = _archive_root(base, REPORT_ARCHIVE_DIRNAME)
    if not os.path.isdir(root):
        return []
    out = []
    for stamp in sorted(os.listdir(root)):
        d = os.path.join(root, stamp)
        if not os.path.isdir(d):
            continue
        csv_d = os.path.join(_archive_root(base, CSV_ARCHIVE_DIRNAME), stamp)
        out.append({
            "stamp": stamp,
            "has_report": os.path.exists(os.path.join(d, "report.md")),
            "has_digest": os.path.exists(os.path.join(d, "digest.md")),
            "has_full": os.path.exists(os.path.join(d, "full.json")),
            "n_csv": len(glob.glob(os.path.join(csv_d, "*.csv"))),
            "report_dir": d,
            "csv_dir": csv_d,
        })
    return out


def read_archive_report(base: str, stamp: str | None = None) -> str:
    """Return an archived report.md (default: newest). For reading history back."""
    arcs = list_archives(base)
    if not arcs:
        return "(no legacy archives yet)"
    pick = next((a for a in arcs if a["stamp"] == stamp), None) if stamp else arcs[-1]
    if pick is None:
        return f"(no archive with stamp {stamp}; have: {[a['stamp'] for a in arcs]})"
    for fn in ("report.md", "digest.md"):
        p = os.path.join(pick["report_dir"], fn)
        if os.path.exists(p):
            return open(p, encoding="utf-8").read()
    return f"(archive {pick['stamp']} has no report.md/digest.md)"


def latest_snapshot(base: str) -> str | None:
    p = os.path.join(base, "LATEST")
    if not os.path.exists(p):
        return None
    d = os.path.join(base, open(p).read().strip())
    return d if os.path.isdir(d) else None


def list_snapshots(base: str) -> list[str]:
    if not os.path.isdir(base):
        return []
    return sorted(d for d in os.listdir(base)
                  if os.path.isdir(os.path.join(base, d)) and re.match(r"\d{12}", d))


def compare_snapshots(base: str, a: str | None = None, b: str | None = None) -> str:
    snaps = list_snapshots(base)
    if len(snaps) < 2 and not (a and b):
        return "need >=2 snapshots to compare"
    a = a or snaps[-2]
    b = b or snaps[-1]
    ja = json.load(open(os.path.join(base, a, "full.json"), encoding="utf-8"))
    jb = json.load(open(os.path.join(base, b, "full.json"), encoding="utf-8"))
    L = [f"# Compare {a} -> {b}", f"as-of {ja['asof_et']} -> {jb['asof_et']}"]
    pa = ja["regime"].get("permission_hint")
    pb = jb["regime"].get("permission_hint")
    L.append(f"permission: {pa} -> {pb}" + ("  **CHANGED**" if pa != pb else ""))
    ka = set(ja["regime"]["breadth"]["kill_list"])
    kb = set(jb["regime"]["breadth"]["kill_list"])
    if ka != kb:
        L.append(f"kill list: +{sorted(kb-ka)} -{sorted(ka-kb)}")
    L.append("\n|sym|stage|px chg%|1D cmf Δ|1D IPI|note|")
    L.append("|--|--|--|--|--|--|")
    for s in sorted(set(jb["views"]) | set(ja["views"])):
        va, vb = ja["views"].get(s, {}), jb["views"].get(s, {})
        sa = (va.get("_stage") or {}).get("stage")
        sb = (vb.get("_stage") or {}).get("stage")
        da, db_ = va.get("1d") or {}, vb.get("1d") or {}
        if not db_:
            continue
        chg = (db_["close"] / da["close"] - 1) * 100 if da.get("close") else None
        dcmf = (db_.get("cmf") or 0) - (da.get("cmf") or 0) if da else None
        note = f"stage {sa}->{sb}" if sa != sb else ""
        flip = da and (da.get("cmf") or 0) > 0 > (db_.get("cmf") or 0)
        if flip:
            note += " 1D-CMF FLIPPED NEG (exit rule)"
        if note or (chg is not None and abs(chg) > 3):
            L.append(f"|{s}|{sb}|{fmt(round(chg,1) if chg is not None else None)}|"
                     f"{fmt(round(dcmf,3) if dcmf is not None else None)}|{db_.get('status')}|{note}|")
    return "\n".join(L)
