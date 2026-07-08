"""rank.py — pre-built UIPT-S / UIPT-M / port rankings for skill-automate.

So a non-Claude AI can get the same ranked shortlist Claude produces, without
writing pandas. The AI still writes the entry/stop/target narrative and regime
call itself (those stay judgment). Reads the latest full.json only.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = os.path.join(ROOT, ".claude/skills/us-stock-fund-manager/scripts")
sys.path.insert(0, SCR)
import radar_lib as R  # noqa: E402


def load():
    snap = R.latest_snapshot(os.path.join(ROOT, "history"))
    if not snap:
        sys.exit("no snapshot — run `radar run` first")
    return json.load(open(os.path.join(snap, "full.json"), encoding="utf-8"))


def f(x, s=""):
    return "na" if x is None else format(x, s)


def rank_medium(d, n=15):
    """UIPT-M: Phase-2 survivors ranked for 1-2 month holds."""
    v = d["views"]
    out = []
    for s, x in v.items():
        st = (x.get("_stage") or {}).get("stage")
        if st not in ("SETUP", "MACRO-WATCH", "TRIGGER", "SETUP(loose)"):
            continue
        w, d1 = x.get("1w", {}), x.get("1d", {})
        sc = 0
        if w.get("status") == "Accum":
            sc += 30
        if (w.get("cmf") or 0) > 0:
            sc += 15
        if (d1.get("cmf") or 0) > 0:
            sc += 10
        if d1.get("status") == "Accum":
            sc += 10
        ext = (x.get("_stage") or {}).get("ext200_pct") or 0
        sc -= 20 if ext > 40 else (8 if ext > 25 else 0)
        if (d1.get("rsi") or 50) > 72:
            sc -= 10
        sc += {"SETUP": 15, "MACRO-WATCH": 8}.get(st, 0)
        L = x.get("_levels") or {}
        out.append((sc, s, st, x.get("px_now"), w.get("status"), d1.get("cmf"),
                    d1.get("status"), d1.get("rsi"), ext, L.get("e20d"), L.get("e50d"),
                    L.get("e200d"), L.get("atr14d"), L.get("swing_hi15")))
    out.sort(reverse=True)
    print("# UIPT-M ranking (medium 1-8W) — Phase-2 survivors")
    print("| # | sym | stage | score | px | 1W_IPI | 1Dcmf | 1D_IPI | rsi | ext% | E20d | E50d | E200d | ATR | swHi |")
    print("|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|")
    for i, r in enumerate(out[:n], 1):
        print("| " + " | ".join([str(i), r[1], str(r[2]), str(r[0]), f(r[3]), str(r[4]),
              f(r[5]), str(r[6]), f(r[7]), f(r[8]), f(r[9]), f(r[10]), f(r[11]), f(r[12]), f(r[13])]) + " |")


def rank_short(d, n=15):
    """UIPT-S: 1H ignition + coil proximity, exclude KILL/FAIL/extended."""
    v = d["views"]
    out = []
    for s, x in v.items():
        st = (x.get("_stage") or {}).get("stage")
        if st in ("KILL", "FAIL", "NO-DATA", "KILL-S", "FAIL-S", None):
            continue
        h1, c = x.get("1h", {}), x.get("_coil")
        rvol = h1.get("rvol") or 0
        cmf1 = h1.get("cmf20") or 0
        ext = (x.get("_stage") or {}).get("ext200_pct") or 0
        sc = 0
        sc += 30 if rvol > 2 else (18 if rvol > 1.5 else (8 if rvol > 1.2 else 0))
        sc += 20 if cmf1 > 0.15 else (8 if cmf1 > 0 else 0)
        if h1.get("status") == "Accum":
            sc += 15
        if c and c.get("tag") == "NEAR-PIVOT" and abs(c.get("dist_pct", 9)) < 2:
            sc += 20
        if ext > 40:
            sc -= 15
        if (x.get("1d", {}).get("rsi") or 50) > 75:
            sc -= 10
        if x.get("4h", {}).get("gc"):
            sc += 5
        if sc <= 0:
            continue
        L = x.get("_levels") or {}
        out.append((sc, s, st, x.get("px_now"), rvol, cmf1, h1.get("status"),
                    c.get("pivot15d") if c else None, c.get("dist_pct") if c else None,
                    ext, L.get("e20_1h"), L.get("vwap_1h"), L.get("atr14d"), L.get("swing_hi15")))
    out.sort(reverse=True)
    print("# UIPT-S ranking (short 1-5D) — 1H ignition + coil")
    print("| # | sym | stage | score | px | 1Hrvol | 1Hcmf | 1Hipi | pivot | dist% | ext% | 1He20 | vwap | ATR | swHi |")
    print("|--|--|--|--|--|--|--|--|--|--|--|--|--|--|--|")
    for i, r in enumerate(out[:n], 1):
        print("| " + " | ".join([str(i), r[1], str(r[2]), str(r[0]), f(r[3]), f(r[4]), f(r[5]),
              str(r[6]), f(r[7]), f(r[8]), f(r[9]), f(r[10]), f(r[11]), f(r[12]), f(r[13])]) + " |")


def rank_port(d):
    """Map every portfolio holding to its stage + P&L."""
    v = d["views"]
    port = R.parse_port(os.path.join(ROOT, "my_port.md"))
    print("# Portfolio marks (with stage)")
    print("| sym | book | sh | cost | px | P&L$ | P&L% | stage | 1W_IPI | 1D_IPI |")
    print("|--|--|--|--|--|--|--|--|--|--|")
    for p in port:
        x = v.get(p["sym"])
        if not x or not x.get("px_now"):
            print(f"| {p['sym']} | {p['book']} | {p['shares']:g} | {p['cost']} | na | | | not-in-export | | |")
            continue
        px = x["px_now"]
        pl = (px - p["cost"]) * p["shares"]
        print(f"| {p['sym']} | {p['book']} | {p['shares']:g} | {p['cost']} | {px:.2f} | "
              f"{pl:+.0f} | {(px/p['cost']-1)*100:+.1f} | {(x.get('_stage') or {}).get('stage')} | "
              f"{x.get('1w', {}).get('status')} | {x.get('1d', {}).get('status')} |")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "medium"
    n = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 15
    d = load()
    print(f"as-of {d['asof_et']} ET | mode {d['screen_mode']} | permission_hint: {d['regime']['permission_hint']}\n")
    if which in ("m", "medium"):
        rank_medium(d, n)
    elif which in ("s", "short"):
        rank_short(d, n)
    elif which in ("p", "port", "portfolio"):
        rank_port(d)
    elif which == "all":
        rank_medium(d, n); print(); rank_short(d, n); print(); rank_port(d)
    else:
        sys.exit("usage: rank.py [medium|short|port|all] [N]")
