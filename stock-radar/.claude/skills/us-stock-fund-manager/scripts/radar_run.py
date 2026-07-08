#!/usr/bin/env python3
"""radar_run — one-command CSV/UIPT screen with history snapshots.

Usage (from the stock-radar project root, via run.sh to auto-venv):
  scripts/run.sh                      # auto mode (see below)
  scripts/run.sh --digest             # print latest saved digest, NO recompute
  scripts/run.sh --compare            # diff the two latest snapshots
  scripts/run.sh --compare A B        # diff two named snapshots
  scripts/run.sh --force              # recompute even if fingerprint unchanged (history kept)
  scripts/run.sh --force-mode         # wipe ALL history, then recompute from the newest csv set
  scripts/run.sh --clean-csv          # delete superseded csv duplicates (keep newest per tf/part)
  scripts/run.sh --clean-history 10   # keep only the 10 newest snapshots
  scripts/run.sh --csv-dir csv --port my_port.md --history history

Auto mode logic (token saver):
  - fingerprint the newest csv set
  - if a snapshot with the same fingerprint exists -> print its digest (cheap)
  - else -> full screen, save history/<asof>_<fp>/{digest.md,full.json}, print digest
"""
import argparse, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import radar_lib as R  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", default="csv")
    ap.add_argument("--port", default="my_port.md")
    ap.add_argument("--history", default="history")
    ap.add_argument("--digest", action="store_true", help="print latest saved digest only")
    ap.add_argument("--compare", nargs="*", metavar="SNAP", help="compare snapshots (default: latest two)")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--force-mode", action="store_true",
                    help="wipe ALL history first, then recompute from the newest csv set")
    ap.add_argument("--clean-csv", action="store_true",
                    help="delete superseded csv duplicates, keep newest per tf/part")
    ap.add_argument("--clean-history", type=int, metavar="KEEP",
                    help="delete old snapshots, keep newest KEEP (0 = delete all)")
    ap.add_argument("--save-report", metavar="FILE",
                    help="save a report .md as report_latest.md + a dated archive copy in history/reports/ (survives clean-all)")
    ap.add_argument("--clean-all", action="store_true",
                    help="delete ALL csv files + ALL history snapshots (nuclear option)")
    ap.add_argument("--clear-all", action="store_true",
                    help="STAMP the current set into the permanent legacy archive "
                         "(csv_archive/ + report_archive/), then delete the working "
                         "csv/ + history/ so a fresh set can start clean")
    ap.add_argument("--archives", action="store_true",
                    help="list every legacy set ever stamped (reads archive, no recompute)")
    ap.add_argument("--archive-report", nargs="?", const="", metavar="STAMP",
                    help="print an archived report (default: newest) for reading history back")
    a = ap.parse_args()

    if a.archives:
        arcs = R.list_archives(a.history)
        if not arcs:
            print("no legacy archives yet — run --clear-all to stamp the current set")
            return
        print(f"legacy archives ({len(arcs)}), newest last:")
        for x in arcs:
            have = "".join(k for k, ok in
                           (("R", x["has_report"]), ("D", x["has_digest"]), ("J", x["has_full"])) if ok)
            print(f"  {x['stamp']}  [{have or '-'}]  csv={x['n_csv']}  -> {x['report_dir']}")
        print("\nread one with:  run.sh --archive-report <stamp>   (omit stamp = newest)")
        return

    if a.archive_report is not None:
        print(R.read_archive_report(a.history, a.archive_report or None))
        return

    if a.clear_all:
        import glob, shutil
        csv_files = glob.glob(os.path.join(a.csv_dir, "*.csv"))
        snap = R.latest_snapshot(a.history)
        has_snap = bool(snap) or bool(R.list_snapshots(a.history)) or bool(R.list_reports(a.history))
        if not csv_files and not has_snap:
            # nothing to preserve — skip the empty stamp, just make sure working
            # dirs exist and are clean. "archive อาจจะไม่มีก็ได้"
            os.makedirs(a.history, exist_ok=True)
            print("[skip]  nothing to archive (no csv, no snapshot/report) — "
                  "working dirs already clean, no empty archive created.")
            print("ready for a fresh csv set.")
            return
        info = R.archive_set(a.history, a.csv_dir)
        print(f"[stamp] legacy archive '{info['stamp']}':"
              f" {info['n_csv']} csv -> {info['csv_archive']}")
        print(f"        report/digest ({', '.join(info['kinds']) or 'none'})"
              f" -> {info['report_archive']}")
        for f in csv_files:
            os.remove(f)
        if os.path.isdir(a.history):
            shutil.rmtree(a.history)
        os.makedirs(a.history, exist_ok=True)
        print(f"[wipe]  deleted {len(csv_files)} working csv + wiped {a.history}/"
              f" (snapshots + reports)")
        print(f"[keep]  legacy archive is untouched — read it back with"
              f" run.sh --archives / --archive-report")
        print("ready for a fresh csv set.")
        return

    if a.save_report:
        md = open(a.save_report, encoding="utf-8").read()
        state = None
        snap = R.latest_snapshot(a.history)
        if snap:
            import json as _json
            state = _json.load(open(os.path.join(snap, "full.json"), encoding="utf-8"))
        latest, dated = R.save_report(a.history, md, state)
        print(f"saved report -> {latest}\n       archive -> {dated}")
        return

    if a.clean_all:
        import glob
        csv_files = glob.glob(os.path.join(a.csv_dir, "*.csv"))
        for f in csv_files:
            os.remove(f)
            print(f"deleted {os.path.basename(f)}")
        rm_hist = R.clean_history(a.history, 0)  # snapshots only (\d{12} dirs)
        n_reports = len(R.list_reports(a.history))
        print(f"clean-all: removed {len(csv_files)} csv files + {len(rm_hist)} snapshots"
              f" | KEPT {n_reports} dated report(s) in {a.history}/reports/ (never cleared)")
        return

    if a.force_mode:
        rm = R.clean_history(a.history, 0)
        print(f"force-mode: cleared {len(rm)} snapshot(s) from {a.history}/")
        a.force = True

    if a.clean_csv:
        rm = R.clean_csv(a.csv_dir)
        print(f"clean-csv: removed {len(rm)}: {rm}" if rm else "clean-csv: no duplicates")
        return
    if a.clean_history is not None:
        rm = R.clean_history(a.history, a.clean_history)
        print(f"clean-history: removed {len(rm)}: {rm}" if rm else "clean-history: nothing to remove")
        return

    if a.compare is not None:
        args = a.compare[:2]
        print(R.compare_snapshots(a.history, *args))
        return

    if a.digest:
        d = R.latest_snapshot(a.history)
        if not d:
            sys.exit("no snapshots yet — run without --digest first")
        print(open(os.path.join(d, "digest.md"), encoding="utf-8").read())
        print(f"\n[source: {d} — saved digest, no recompute]")
        return

    # auto: skip recompute when the csv set is unchanged
    fps = [p for tf in R.TFS for p in R.newest_parts(a.csv_dir, tf)]
    fp = R.fingerprint(fps) if fps else None
    if fp and not a.force:
        for snap in R.list_snapshots(a.history):
            if snap.endswith(fp[:8]):
                print(open(os.path.join(a.history, snap, "digest.md"), encoding="utf-8").read())
                print(f"\n[source: history/{snap} — csv set unchanged (fingerprint {fp[:8]}), reused saved result; --force to recompute]")
                return

    state = R.run_screen(a.csv_dir, a.port if os.path.exists(a.port) else None)
    d = R.save_history(a.history, state)
    print(state["digest"])
    print(f"\n[saved: {d} — digest.md + full.json]")


if __name__ == "__main__":
    main()
