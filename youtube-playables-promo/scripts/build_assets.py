"""
Builds the final store / marketing kit.

Inputs (under <outDir>, default "marketing"):
  raw/*.png                AI art from run_codex_jobs.py (icon, logo, cover-*, key art)
  screenshots/<device>/    real captures from capture.py
  preview/frames-<name>/   fixed-timestep frames from capture.py
Output: <outDir>/dist/... + dist/manifest.json + dist/contact-sheet.jpg

Usage (from the project root):  python build_assets.py promo.config.json
Requires: pip install pillow imageio-ffmpeg   (or ffmpeg on PATH)
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

L169 = (0.03, 0.04, 0.42, 0.3)
DEFAULT_COVERS = [
    ("banner-16x9-3840x2160", "cover-landscape.png", 3840, 2160, (0.5, 0.5), L169),
    ("banner-16x9-1920x1080", "cover-landscape.png", 1920, 1080, (0.5, 0.5), L169),
    ("banner-16x9-1280x720", "cover-landscape.png", 1280, 720, (0.5, 0.5), L169),
    ("banner-16x9-480x270", "cover-landscape.png", 480, 270, (0.5, 0.5), (0.03, 0.04, 0.45, 0.33)),
    ("banner-16x9-240x135", "cover-landscape.png", 240, 135, (0.5, 0.5), None),
    ("banner-9x16-1080x1920", "cover-portrait.png", 1080, 1920, (0.5, 0.5), (0.08, 0.03, 0.84, 0.17)),
    ("banner-9x16-270x480", "cover-portrait.png", 270, 480, (0.5, 0.5), (0.08, 0.03, 0.84, 0.17)),
    ("banner-9x16-135x240", "cover-portrait.png", 135, 240, (0.5, 0.5), None),
    ("phone-9x19.5-1170x2532", "cover-portrait.png", 1170, 2532, (0.5, 0.5), (0.08, 0.04, 0.84, 0.14)),
    ("tablet-3x4-1536x2048", "cover-portrait.png", 1536, 2048, (0.5, 0.55), (0.1, 0.03, 0.8, 0.17)),
    ("tablet-4x3-2048x1536", "cover-landscape.png", 2048, 1536, (0.5, 0.5), (0.03, 0.03, 0.44, 0.26)),
    ("square-1x1-1080", "cover-square.png", 1080, 1080, (0.5, 0.5), (0.04, 0.03, 0.5, 0.22)),
    ("square-1x1-512", "cover-square.png", 512, 512, (0.5, 0.5), (0.04, 0.03, 0.5, 0.22)),
    ("social-og-1200x630", "cover-landscape.png", 1200, 630, (0.5, 0.5), (0.03, 0.04, 0.42, 0.32)),
    ("social-x-1500x500", "cover-landscape.png", 1500, 500, (0.5, 0.36), (0.02, 0.08, 0.34, 0.5)),
    ("ultrawide-21x9-2560x1080", "cover-landscape.png", 2560, 1080, (0.5, 0.4), (0.03, 0.05, 0.34, 0.34)),
    ("youtube-thumb-1280x720", "cover-landscape.png", 1280, 720, (0.5, 0.5), L169),
]
ICON_SIZES = (1024, 512, 256, 192, 180, 128, 96, 64, 48, 32, 16)


class Builder:
    def __init__(self, cfg):
        self.cfg = cfg
        base = cfg.get("outDir", "marketing")
        self.raw = os.path.join(base, "raw")
        self.shots = os.path.join(base, "screenshots")
        self.preview = os.path.join(base, "preview")
        self.dist = os.path.join(base, "dist")
        self.manifest = []

    # ------------------------------------------------------------------ io
    def path(self, rel):
        p = os.path.join(self.dist, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p

    def save(self, img, rel):
        p = self.path(rel)
        if rel.endswith(".jpg"):
            img.convert("RGB").save(p, quality=90, optimize=True, progressive=True)
        else:
            img.save(p, optimize=True)
        self.manifest.append({"file": rel.replace("\\", "/"), "width": img.width, "height": img.height})

    def load(self, name):
        p = os.path.join(self.raw, name)
        return Image.open(p).convert("RGBA") if os.path.exists(p) else None

    # ------------------------------------------------------------------ geometry
    @staticmethod
    def cover(img, w, h, focus=(0.5, 0.5)):
        s = max(w / img.width, h / img.height)
        r = img.resize((max(w, round(img.width * s)), max(h, round(img.height * s))), Image.LANCZOS)
        x = min(max(0, round(r.width * focus[0] - w / 2)), r.width - w)
        y = min(max(0, round(r.height * focus[1] - h / 2)), r.height - h)
        return r.crop((x, y, x + w, y + h))

    @staticmethod
    def fit(img, w, h):
        s = min(w / img.width, h / img.height)
        return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)

    # ------------------------------------------------------------------ logo
    def build_logo(self):
        lg = self.load("logo.png")
        if lg is None:
            print("! raw/logo.png missing (covers will have no logo)")
            return None
        if lg.getchannel("A").getextrema()[0] == 255:  # opaque -> key out corner colour
            bg = lg.getpixel((4, 4))[:3]
            px = lg.load()
            for y in range(lg.height):
                for x in range(lg.width):
                    r, g, b, _ = px[x, y]
                    d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
                    if d < 60:
                        px[x, y] = (r, g, b, 0 if d < 30 else int((d - 30) / 30 * 255))
        bbox = lg.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
        if bbox:
            lg = lg.crop(bbox)
        self.save(lg, "logo/logo-transparent.png")
        for w in (1024, 512, 256):
            self.save(self.fit(lg, w, w), f"logo/logo-{w}w.png")
        return lg

    def with_logo(self, img, logo, box):
        if logo is None or not box:
            return img
        W, H = img.size
        bw, bh = int(box[2] * W), int(box[3] * H)
        lg = self.fit(logo, bw, bh)
        x = int(box[0] * W + (bw - lg.width) / 2)
        y = int(box[1] * H + (bh - lg.height) / 2)
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        blob = Image.new("RGBA", lg.size, (20, 20, 50, 255))
        blob.putalpha(lg.getchannel("A").point(lambda v: int(v * 0.45)))
        shadow.alpha_composite(blob, (x, y + max(4, lg.height // 30)))
        shadow = shadow.filter(ImageFilter.GaussianBlur(max(3, lg.height // 40)))
        res = img.copy()
        res.alpha_composite(shadow)
        res.alpha_composite(lg, (x, y))
        return res

    # ------------------------------------------------------------------ icons
    def build_icons(self):
        src = self.load("icon.png")
        if src is None:
            print("! raw/icon.png missing")
            return
        sq = self.cover(src, 1024, 1024)
        flat = Image.new("RGB", sq.size, (255, 255, 255))
        flat.paste(sq, mask=sq.getchannel("A"))  # store icons must be opaque
        for s in ICON_SIZES:
            self.save(flat.resize((s, s), Image.LANCZOS), f"icons/icon-{s}.png")
        for s in (512, 256):
            base = flat.resize((s, s), Image.LANCZOS).convert("RGBA")
            for kind in ("rounded", "circle"):
                m = Image.new("L", (s, s), 0)
                d = ImageDraw.Draw(m)
                if kind == "rounded":
                    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=255)
                else:
                    d.ellipse((0, 0, s - 1, s - 1), fill=255)
                v = base.copy()
                v.putalpha(m)
                self.save(v, f"icons/icon-{kind}-{s}.png")
        flat.save(self.path("icons/favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        self.manifest.append({"file": "icons/favicon.ico", "width": 64, "height": 64})

    # ------------------------------------------------------------------ covers / key art
    def covers(self):
        if "covers" in self.cfg:
            return [(c["name"], c["src"], c["size"][0], c["size"][1], tuple(c.get("focus", (0.5, 0.5))),
                     tuple(c["logo"]) if c.get("logo") else None) for c in self.cfg["covers"]]
        return DEFAULT_COVERS

    def build_covers(self, logo):
        for name, raw, w, h, focus, box in self.covers():
            src = self.load(raw)
            if src is None:
                print(f"! raw/{raw} missing ({name})")
                continue
            base = self.cover(src, w, h, focus)
            self.save(base, f"cover-art/clean/{name}.jpg")
            if box and logo is not None:
                self.save(self.with_logo(base, logo, box), f"cover-art/with-logo/{name}.jpg")
        for k in self.cfg.get("keyArt", []):
            src = self.load(k["src"])
            if src is None:
                print(f"! raw/{k['src']} missing ({k['name']})")
                continue
            self.save(self.cover(src, k["size"][0], k["size"][1], tuple(k.get("focus", (0.5, 0.5)))), f"key-art/{k['name']}.jpg")

    # ------------------------------------------------------------------ screenshots
    def build_screenshots(self):
        if not os.path.isdir(self.shots):
            print("! no screenshots captured")
            return
        for dev in sorted(os.listdir(self.shots)):
            dd = os.path.join(self.shots, dev)
            for f in sorted(os.listdir(dd)):
                if f.endswith(".png"):
                    self.save(Image.open(os.path.join(dd, f)).convert("RGB"), f"screenshots/{dev}/{f}")
        store = self.cfg.get("storeShots", {})
        order = store.get("order", [])
        for dev, tag in store.get("sets", {}).items():
            dd = os.path.join(self.shots, dev)
            if not os.path.isdir(dd):
                print(f"! store set device missing: {dev}")
                continue
            n = 0
            for scene in order:
                p = os.path.join(dd, scene + ".png")
                if os.path.exists(p):
                    n += 1
                    label = scene.split("-", 1)[1] if scene[:2].isdigit() else scene
                    self.save(Image.open(p).convert("RGB"), f"store/screenshots-{tag}/{n:02d}-{label}.jpg")
            if n < 3:
                print(f"! only {n} store screenshots for {tag} (portals usually need >= 3)")

    # ------------------------------------------------------------------ previews
    @staticmethod
    def ffmpeg():
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:  # noqa: BLE001
            return shutil.which("ffmpeg")

    def build_previews(self):
        exe = self.ffmpeg()
        for pv in self.cfg.get("previews", []):
            name = pv["name"]
            w, h = pv.get("size", [1920, 1080])
            fps = int(pv.get("fps", 15))
            d = os.path.join(self.preview, f"frames-{name}")
            if not os.path.isdir(d) or not os.listdir(d):
                print(f"! no preview frames for {name}")
                continue
            pattern = os.path.join(d, "%04d.png")
            if exe:
                rel = f"previews/gameplay-{name}-{w}x{h}.mp4"
                subprocess.run([exe, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", pattern,
                                "-vf", f"scale={w}:{h}:flags=lanczos,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                                "-crf", "20", "-preset", "medium", "-movflags", "+faststart", self.path(rel)], check=True)
                self.manifest.append({"file": rel, "width": w, "height": h})
                rel = f"previews/gameplay-{name}-{w // 2}x{h // 2}.webm"
                subprocess.run([exe, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", pattern,
                                "-vf", f"scale={w // 2}:{h // 2}:flags=lanczos", "-c:v", "libvpx-vp9", "-b:v", "0",
                                "-crf", "36", "-row-mt", "1", self.path(rel)], check=True)
                self.manifest.append({"file": rel, "width": w // 2, "height": h // 2})
            else:
                print("! ffmpeg not found: skipping MP4/WebM (pip install imageio-ffmpeg)")
            frames = sorted(os.listdir(d))
            start = len(frames) // 5
            gw = 480 if w >= h else 270
            gh = round(gw * h / w)
            imgs = [Image.open(os.path.join(d, f)).convert("RGB").resize((gw, gh), Image.LANCZOS)
                    for f in frames[start:start + fps * 6:2]]
            if imgs:
                pal = [im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
                rel = f"previews/gameplay-{name}-{gw}x{gh}.gif"
                pal[0].save(self.path(rel), save_all=True, append_images=pal[1:], duration=int(2000 / fps), loop=0, optimize=True)
                self.manifest.append({"file": rel, "width": gw, "height": gh})

    # ------------------------------------------------------------------ review
    def contact_sheet(self):
        files = [m["file"] for m in self.manifest if m["file"].endswith((".jpg", ".png"))
                 and "/clean/" not in m["file"] and not m["file"].startswith(("screenshots/", "icons/icon-"))]
        thumbs = []
        icon = os.path.join(self.dist, "icons/icon-256.png")
        if os.path.exists(icon):
            thumbs.append(Image.open(icon).convert("RGB").resize((200, 200)))
        for f in files[:44]:
            im = Image.open(os.path.join(self.dist, f)).convert("RGB")
            im.thumbnail((360, 360))
            thumbs.append(im)
        if not thumbs:
            return
        cols, cell, pad = 5, 360, 12
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (cell + pad) + pad, rows * (cell + pad) + pad), (27, 42, 74))
        for i, t in enumerate(thumbs):
            sheet.paste(t, (pad + (i % cols) * (cell + pad) + (cell - t.width) // 2,
                            pad + (i // cols) * (cell + pad) + (cell - t.height) // 2))
        sheet.save(self.path("contact-sheet.jpg"), quality=85)

    def run(self):
        if os.path.isdir(self.dist):
            shutil.rmtree(self.dist)
        logo = self.build_logo()
        self.build_icons()
        self.build_covers(logo)
        self.build_screenshots()
        self.build_previews()
        self.contact_sheet()
        with open(self.path("manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=2)
        print(f"built {len(self.manifest)} files into {self.dist}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    Builder(json.load(open(sys.argv[1], encoding="utf-8"))).run()
