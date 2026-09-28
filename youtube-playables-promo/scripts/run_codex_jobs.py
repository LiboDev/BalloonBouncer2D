"""
Runs one headless Codex agent per image job (in parallel) using Codex's built-in image
generation tool. Each agent gets the shared style brief, its prompt and reference
screenshots, and must save exactly one PNG to the job's output path.

Usage (from the project root):
  python run_codex_jobs.py jobs.json                 all jobs
  python run_codex_jobs.py jobs.json icon logo       only these ids
  python run_codex_jobs.py jobs.json --dry-run       print commands + prompts, run nothing
  python run_codex_jobs.py jobs.json --max-parallel 4
Logs: <dir of first job output>/../_jobs/<id>.log
"""
import json
import os
import shutil
import subprocess
import sys
import time


def build_prompt(style, job):
    extra = ""
    if job.get("background") == "transparent":
        extra = " Request a transparent background from the image tool so the PNG has an alpha channel."
    return (
        "You are generating marketing art. Use your built-in image generation tool (do not draw with code, "
        "SVG, canvas or Python; do not download images). Generate exactly ONE image, "
        f"orientation/size {job['size']}.{extra}\n\n"
        f"STYLE BRIEF: {style}\n\n"
        f"IMAGE: {job['prompt']}\n\n"
        f"When the image is generated, copy the PNG file to this exact path (relative to the current directory): "
        f"{job['out']} - overwrite if it exists. Do not create any other files. Reply with only the saved path."
    )


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    cfg = json.load(open(args[0], encoding="utf-8"))
    dry = "--dry-run" in args
    max_par = 8
    if "--max-parallel" in args:
        max_par = int(args[args.index("--max-parallel") + 1])
    ids = [a for a in args[1:] if not a.startswith("--") and not a.isdigit()]
    jobs = [j for j in cfg["jobs"] if not ids or j["id"] in ids]
    codex = shutil.which("codex") or "codex"
    log_dir = os.path.join(os.path.dirname(os.path.dirname(jobs[0]["out"])) or ".", "_jobs") if jobs else "_jobs"
    os.makedirs(log_dir, exist_ok=True)

    pending = list(jobs)
    running = []
    results = []
    while pending or running:
        while pending and len(running) < max_par:
            job = pending.pop(0)
            cmd = [codex, "exec", "--skip-git-repo-check", "-s", "workspace-write"]
            for r in job.get("refs", []):
                if os.path.exists(r):
                    cmd += ["-i", r]
                else:
                    print(f"  ! missing ref {r} for {job['id']}")
            cmd.append("-")  # prompt via stdin
            prompt = build_prompt(cfg["style"], job)
            if dry:
                print(" ".join(cmd), "\n  <<", prompt[:300].replace("\n", " "), "...\n")
                continue
            os.makedirs(os.path.dirname(job["out"]) or ".", exist_ok=True)
            if os.path.exists(job["out"]):
                os.remove(job["out"])
            log = open(os.path.join(log_dir, f"{job['id']}.log"), "w", encoding="utf-8")
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=log, stderr=subprocess.STDOUT)
            p.stdin.write(prompt.encode("utf-8"))
            p.stdin.close()
            running.append((job, p, log, time.time()))
            print(f"started {job['id']}", flush=True)
            time.sleep(2)
        if dry:
            break
        for item in list(running):
            job, p, log, t0 = item
            if p.poll() is None:
                if time.time() - t0 > 1800:
                    p.kill()
                else:
                    continue
            log.close()
            running.remove(item)
            ok = os.path.exists(job["out"])
            results.append((job["id"], ok))
            print(f"{job['id']:18s} exit={p.returncode} saved={ok} {time.time() - t0:.0f}s", flush=True)
        time.sleep(2)
    failed = [i for i, ok in results if not ok]
    if failed:
        print("FAILED:", " ".join(failed), "(re-run with these ids; see _jobs/<id>.log)")
        sys.exit(2)


if __name__ == "__main__":
    main()
