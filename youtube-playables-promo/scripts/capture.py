"""
Config-driven capture of REAL gameplay screenshots and fixed-timestep preview frames.

Usage (from the project root, dev server running):
  python capture.py promo.config.json                  all devices + previews
  python capture.py promo.config.json phone-tall       only these devices (and no previews)
  python capture.py promo.config.json --previews-only
  python capture.py promo.config.json --no-preview
  python capture.py promo.config.json --resume         skip devices that already have every shot
  python capture.py promo.config.json --refs-only      only build <out>/ref from existing screenshots

See references/capture.md for the config schema and step types.
"""
import json
import os
import sys
import time

DEFAULT_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]


def load_cfg(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class Capturer:
    def __init__(self, cfg, browser):
        self.cfg = cfg
        self.browser = browser
        self.out = cfg.get("outDir", "marketing")
        self.ready = cfg.get("ready", "window.__game !== undefined")
        self.timeout = int(cfg.get("waitTimeout", 45000))
        bot = cfg.get("bot", {})
        self.bot_js = bot.get("js", "() => 0")
        self.sens = float(bot.get("sensitivity", 3))
        self.range = float(bot.get("range", 0.2))
        self.anchor = bot.get("anchor", [0.5, 0.7])

    # ------------------------------------------------------------------ helpers
    def url(self, scale, extra=""):
        u = self.cfg["url"].replace("{scale}", str(scale))
        return u + extra

    def open(self, w, h, scale, extra=""):
        page = self.browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        page.goto(self.url(scale, extra), timeout=self.timeout)
        page.wait_for_function(self.ready, timeout=self.timeout)
        time.sleep(float(self.cfg.get("bootDelay", 1.2)))
        return page

    def aim(self, page, w, h):
        dx = page.evaluate(self.bot_js) or 0
        x = w * self.anchor[0] + max(-1, min(1, dx / self.sens)) * min(w, h) * self.range
        page.mouse.move(x, h * self.anchor[1])

    def steer(self, page, w, h, secs):
        end = time.time() + secs
        while time.time() < end:
            self.aim(page, w, h)
            time.sleep(0.08)

    # ------------------------------------------------------------------ screenshots
    def expected_shots(self):
        return [s["shot"] for s in self.cfg["scenes"] if "shot" in s]

    def device_done(self, name):
        d = os.path.join(self.out, "screenshots", name)
        return all(os.path.exists(os.path.join(d, n + ".png")) for n in self.expected_shots())

    def run_device(self, name, dev):
        w, h = dev["viewport"]
        scale = dev.get("scale", 2)
        d = os.path.join(self.out, "screenshots", name)
        os.makedirs(d, exist_ok=True)
        page = self.open(w, h, scale)
        try:
            for step in self.cfg["scenes"]:
                if "shot" in step:
                    page.screenshot(path=os.path.join(d, step["shot"] + ".png"))
                elif "eval" in step:
                    page.evaluate(step["eval"])
                elif "steer" in step:
                    self.steer(page, w, h, float(step["steer"]))
                elif "sleep" in step:
                    time.sleep(float(step["sleep"]))
                elif "waitFor" in step:
                    page.wait_for_function(step["waitFor"], timeout=int(step.get("timeout", self.timeout)))
                elif "mouseDown" in step:
                    page.mouse.move(w * self.anchor[0], h * self.anchor[1])
                    page.mouse.down()
                elif "mouseUp" in step:
                    page.mouse.up()
                elif "click" in step:
                    fx, fy = step["click"]
                    page.mouse.click(w * fx, h * fy)
                elif "reload" in step:
                    page.close()
                    page = self.open(w, h, scale)
        finally:
            page.close()

    # ------------------------------------------------------------------ previews
    def run_preview(self, pv):
        w, h = pv["viewport"]
        scale = pv.get("scale", 1)
        fps = int(pv.get("fps", 15))
        total = int(float(pv.get("seconds", 15)) * fps)
        d = os.path.join(self.out, "preview", f"frames-{pv['name']}")
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        page = self.open(w, h, scale, pv.get("urlSuffix", "&capture"))
        step_js = pv.get("stepJs", "window.__game.step({dt})").replace("{dt}", repr(1 / fps))
        many = lambda k: page.evaluate(f"() => {{ for (let i = 0; i < {k}; i++) {step_js}; }}")
        page.mouse.move(w * self.anchor[0], h * self.anchor[1])
        page.mouse.down()
        pre = int(float(pv.get("preroll", 1.2)) * fps)
        if pre:
            many(pre)
        events = {int(total * float(e["at"])): e["js"] for e in pv.get("events", [])}
        t0 = time.time()
        for n in range(total):
            if n in events:
                page.evaluate(events[n])
            self.aim(page, w, h)
            many(1)
            page.screenshot(path=os.path.join(d, f"{n:04d}.png"))
        page.mouse.up()
        page.close()
        print(f"  preview {pv['name']}: {total} frames in {time.time() - t0:.0f}s", flush=True)


def build_refs(cfg):
    from PIL import Image

    out = cfg.get("outDir", "marketing")
    ref_dir = os.path.join(out, "ref")
    os.makedirs(ref_dir, exist_ok=True)
    max_side = int(cfg.get("refMaxSide", 1280))
    for name, rel in cfg.get("refs", {}).items():
        src = os.path.join(out, "screenshots", rel)
        if not os.path.exists(src):
            print(f"! ref source missing: {src}")
            continue
        im = Image.open(src).convert("RGB")
        im.thumbnail((max_side, max_side))
        im.save(os.path.join(ref_dir, name + ".png"))
        print(f"ref {name} {im.size}")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    cfg = load_cfg(args[0])
    flags = {a for a in args[1:] if a.startswith("--")}
    only = [a for a in args[1:] if not a.startswith("--")]
    if "--refs-only" in flags:
        build_refs(cfg)
        return

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        launch = {"args": cfg.get("browserArgs", DEFAULT_ARGS)}
        if cfg.get("channel"):
            launch["channel"] = cfg["channel"]
        browser = p.chromium.launch(**launch)
        cap = Capturer(cfg, browser)
        if "--previews-only" not in flags:
            for name, dev in cfg["devices"].items():
                if only and name not in only:
                    continue
                if "--resume" in flags and cap.device_done(name):
                    print("skip (done)", name, flush=True)
                    continue
                for attempt in (1, 2):  # one retry: software GL occasionally times out
                    try:
                        print(f"capturing {name} (attempt {attempt})", flush=True)
                        cap.run_device(name, dev)
                        break
                    except Exception as e:  # noqa: BLE001
                        print(f"  ! {name}: {str(e).splitlines()[0]}", flush=True)
                        if attempt == 2:
                            print(f"  ! giving up on {name}", flush=True)
        if "--no-preview" not in flags and (not only or "--previews-only" in flags):
            for pv in cfg.get("previews", []):
                cap.run_preview(pv)
        browser.close()
    print("done", flush=True)


if __name__ == "__main__":
    main()
