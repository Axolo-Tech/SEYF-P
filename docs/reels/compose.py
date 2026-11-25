"""Compositor de reels verticales (1080x1920, 30 fps) con PIL + ffmpeg.

Un reel es una lista de tomas. Cada toma dura `d` segundos, tiene un fondo y
capas (teléfono con un clip de la app, noticiero, texto cinético, callouts).
El audio se arma aparte: música + efectos + audio original de los noticieros."""
import json
import math
import os
import subprocess
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import audio as A

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = f"{HERE}/clips"
FONTS = os.path.abspath(f"{HERE}/../../src/app/fonts")
W, H, FPS = 1080, 1920, 30

INK = (18, 14, 36)
LAV = (241, 239, 252)
LIME = (200, 255, 77)
VIOLET = (109, 63, 240)
WHITE = (255, 255, 255)
RED = (255, 77, 77)


# ---------------- tipografías ----------------
@lru_cache(None)
def anton(size):
    return ImageFont.truetype(f"{FONTS}/Anton-latin.woff2", size)


@lru_cache(None)
def manrope(size, weight="ExtraBold"):
    f = ImageFont.truetype(f"{FONTS}/Manrope-latin.woff2", size)
    f.set_variation_by_name(weight)
    return f


# ---------------- easing ----------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(p):
    p = clamp(p)
    return 1 - (1 - p) ** 3


def ease_in_out(p):
    p = clamp(p)
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def ease_back(p, s=1.7):
    p = clamp(p)
    return 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2


# ---------------- lectura de video ----------------
class Reader:
    """Lee cuadros de un video en orden, ya recortados/escalados por ffmpeg."""

    def __init__(self, path, start=0.0, dur=10.0, size=None, crop=None, speed=1.0):
        vf = []
        if crop:
            vf.append("crop=%d:%d:%d:%d" % crop)
        if speed != 1.0:
            vf.append(f"setpts=PTS/{speed}")
        vf.append(f"fps={FPS}")
        if size:
            vf.append(f"scale={size[0]}:{size[1]}:flags=lanczos")
        self.size = size
        cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur * speed + 0.5:.3f}", "-i", path,
               "-vf", ",".join(vf), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        self.p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.last = None
        self.n = 0

    def frame(self, i):
        """Cuadro i (desde el inicio de la toma). Si el clip se acaba, se queda en el último."""
        w, h = self.size
        while self.n <= i:
            buf = self.p.stdout.read(w * h * 3)
            if len(buf) < w * h * 3:
                break
            self.last = Image.frombuffer("RGB", (w, h), buf, "raw", "RGB", 0, 1)
            self.n += 1
        return self.last

    def close(self):
        try:
            self.p.kill()
        except Exception:
            pass


def probe_size(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height", "-of", "csv=p=0", path]).decode().strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


# ---------------- piezas gráficas ----------------
def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m


@lru_cache(None)
def phone_chrome(sw, sh):
    """Marco del teléfono (bisel + sombra) para una pantalla de sw x sh."""
    bez = max(10, sw // 40)
    r = int(sw * 0.13)
    fw, fh = sw + 2 * bez, sh + 2 * bez
    pad = 90
    img = Image.new("RGBA", (fw + 2 * pad, fh + 2 * pad), (0, 0, 0, 0))
    sh_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_img).rounded_rectangle([pad + 10, pad + 40, pad + fw + 10, pad + fh + 40], r + bez, fill=(18, 14, 36, 120))
    sh_img = sh_img.filter(ImageFilter.GaussianBlur(38))
    img.alpha_composite(sh_img)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([pad, pad, pad + fw, pad + fh], r + bez, fill=(14, 12, 22, 255))
    d.rounded_rectangle([pad + 2, pad + 2, pad + fw - 2, pad + fh - 2], r + bez - 2, outline=(70, 66, 90, 255), width=3)
    return img, pad + bez, rounded_mask((sw, sh), r)


def phone_image(screen):
    sw, sh = screen.size
    chrome, off, mask = phone_chrome(sw, sh)
    img = chrome.copy()
    img.paste(screen, (off, off), mask)
    return img


@lru_cache(None)
def blob_bg(kind):
    """Fondo base: lavanda con manchas de color difuminadas, o tinta."""
    if kind == "ink":
        base = Image.new("RGB", (W, H), (14, 11, 31))
        cols = [(109, 63, 240, 140), (60, 200, 255, 60)]
    elif kind == "lime":
        base = Image.new("RGB", (W, H), (228, 251, 178))
        cols = [(200, 255, 77, 200), (139, 92, 246, 60)]
    else:
        base = Image.new("RGB", (W, H), LAV)
        cols = [(185, 164, 255, 170), (200, 255, 77, 120), (143, 193, 255, 110)]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    spots = [(150, 300, 520), (900, 900, 560), (300, 1600, 600)]
    for (x, y, r), c in zip(spots, cols):
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    layer = layer.filter(ImageFilter.GaussianBlur(160))
    base = base.convert("RGBA")
    base.alpha_composite(layer)
    return base.convert("RGB")


GRAIN = [Image.fromarray((np.random.default_rng(i).normal(0, 9, (H // 2, W // 2))).clip(-40, 40).astype(np.int16).astype(np.uint8), "L")
         for i in range(3)]


# ---------------- texto cinético ----------------
def word_img(word, font, color, hl=None, pad=(18, 6), rot=0):
    """Palabra como RGBA; `hl` = color del recuadro tipo sticker detrás."""
    bb = font.getbbox(word)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    px, py = pad if hl else (4, 4)
    img = Image.new("RGBA", (tw + 2 * px + 14, th + 2 * py + 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if hl:
        d.rounded_rectangle([7, 9, tw + 2 * px + 7, th + 2 * py + 9], 14, fill=INK)  # sombra dura
        d.rounded_rectangle([0, 0, tw + 2 * px, th + 2 * py], 14, fill=hl, outline=INK, width=4)
    d.text((px - bb[0], py - bb[1]), word, font=font, fill=color)
    if rot:
        img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
    return img


class Kinetic:
    """Bloque de texto que entra palabra por palabra.
    lines: lista de líneas; cada palabra puede ser "texto" o ("texto", estilo)
    estilos: "hl" (sticker lima), "hv" (sticker violeta), "v" (texto violeta), "l" (texto lima)."""

    def __init__(self, lines, t0=0.0, size=150, y=170, color=INK, stagger=0.07, out=None, align="center",
                 font="anton", x=None, maxw=980):
        self.t0, self.out, self.stagger = t0, out, stagger
        self.items = []
        fnt = anton if font == "anton" else (lambda s: manrope(s))
        # ajusta el tamaño para que la línea más larga quepa
        while True:
            f = fnt(size)
            widths = []
            for line in lines:
                ws = [w if isinstance(w, tuple) else (w, None) for w in line]
                total = 0
                for tx, st in ws:
                    bb = f.getbbox(tx if font != "anton" else tx.upper())
                    total += bb[2] - bb[0] + (36 if st in ("hl", "hv") else 0) + size * 0.22
                widths.append(total)
            if max(widths) <= maxw or size < 40:
                break
            size = int(size * 0.92)
        f = fnt(size)
        lh = size * (1.08 if font == "anton" else 1.25)
        k = 0
        cy = y
        for line, lw in zip(lines, widths):
            cx = (W - lw) / 2 if align == "center" else (x if x is not None else 70)
            for w in line:
                tx, st = w if isinstance(w, tuple) else (w, None)
                if font == "anton":
                    tx = tx.upper()
                col = {"v": VIOLET, "l": LIME, "w": WHITE, "r": RED}.get(st, color)
                hl = {"hl": LIME, "hv": VIOLET, "hw": WHITE, "hr": RED}.get(st)
                tcol = WHITE if st == "hv" else (INK if hl else col)
                rot = (-3 if k % 2 else 2.5) if hl else 0
                img = word_img(tx, f, tcol, hl, rot=rot)
                self.items.append((img, cx, cy - (8 if hl else 0), k))
                bb = f.getbbox(tx)
                cx += bb[2] - bb[0] + (36 if hl else 0) + size * 0.22
                k += 1
            cy += lh
        self.bottom = cy

    def draw(self, canvas, t):
        for img, x, y, k in self.items:
            ts = t - self.t0 - k * self.stagger
            if ts < 0:
                continue
            p = ease_back(ts / 0.38, 2.2)
            a = clamp(ts / 0.15)
            if self.out is not None and t > self.out:
                q = ease_in_out((t - self.out) / 0.3)
                a *= 1 - q
                y = y - 60 * q
            if a <= 0.01:
                continue
            s = 0.55 + 0.45 * p
            iw, ih = img.size
            im = img.resize((max(1, int(iw * s)), max(1, int(ih * s))), Image.BILINEAR) if abs(s - 1) > 0.01 else img
            if a < 0.99:
                im = im.copy()
                im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
            canvas.alpha_composite(im, (int(x + (iw - im.width) / 2), int(y + (ih - im.height) / 2 + (1 - p) * 40)))


class Sticker:
    """Chip/etiqueta tipo sticker que entra con rebote (p.ej. '+$9.59 al día')."""

    def __init__(self, text, x, y, t0, bg=LIME, fg=INK, size=56, rot=-4, out=None, font="manrope", sub=None):
        f = manrope(size) if font == "manrope" else anton(size)
        bb = f.getbbox(text)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        sf = manrope(int(size * 0.5), "Bold") if sub else None
        sh = (sf.getbbox(sub)[3] + 10) if sub else 0
        sw_ = max(tw, sf.getbbox(sub)[2] if sub else 0)
        img = Image.new("RGBA", (sw_ + 70, th + sh + 60), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([8, 10, sw_ + 56, th + sh + 50], 26, fill=INK)
        d.rounded_rectangle([0, 0, sw_ + 48, th + sh + 40], 26, fill=bg, outline=INK, width=5)
        d.text((24 - bb[0], 20 - bb[1]), text, font=f, fill=fg)
        if sub:
            d.text((24, 20 + th + 10), sub, font=sf, fill=fg)
        self.img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
        self.x, self.y, self.t0, self.out = x, y, t0, out

    def draw(self, canvas, t):
        ts = t - self.t0
        if ts < 0:
            return
        p = ease_back(ts / 0.4, 2.6)
        s = 0.3 + 0.7 * p
        a = 1.0
        if self.out is not None and t > self.out:
            a = 1 - clamp((t - self.out) / 0.25)
            if a <= 0:
                return
        bob = math.sin(ts * 2.2) * 6
        im = self.img.resize((max(1, int(self.img.width * s)), max(1, int(self.img.height * s))), Image.BILINEAR)
        if a < 1:
            im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
        x = self.x - im.width // 2 if self.x != "c" else (W - im.width) // 2
        canvas.alpha_composite(im, (int(x), int(self.y - im.height // 2 + bob)))


class Phone:
    """Teléfono con un clip de la app. Entra deslizando; puede acercarse (zoom) a una zona."""

    def __init__(self, clip, start, dur, width=640, x=None, y=560, t_in=0.0, enter="up", speed=1.0,
                 zoom=None, tilt=0.0):
        self.sw = width
        self.sh = int(width * 2338 / 1080)
        self.r = Reader(f"{CLIPS}/{clip}.mp4", start, dur + 1, (self.sw, self.sh), speed=speed)
        self.x = (W - self.sw) // 2 if x is None else x
        self.y, self.t_in, self.enter, self.zoom, self.tilt = y, t_in, enter, zoom, tilt

    def draw(self, canvas, t, i):
        fr = self.r.frame(i)
        if fr is None:
            return
        img = phone_image(fr)
        p = ease_out((t - self.t_in) / 0.55) if self.enter else 1
        dy = (1 - p) * 1100 if self.enter == "up" else 0
        cx = self.x + self.sw / 2
        cy = self.y + self.sh / 2 + dy
        if self.zoom:  # (t0, t1, escala, fx, fy): acercamiento a un punto de la pantalla (0..1)
            z0, z1, zs, fx, fy = self.zoom
            q = ease_in_out((t - z0) / 0.5) * (1 - ease_in_out((t - z1) / 0.5))
            s = 1 + (zs - 1) * q
            if s > 1.001:
                img = img.resize((int(img.width * s), int(img.height * s)), Image.BILINEAR)
                cx -= (fx - 0.5) * self.sw * (s - 1)
                cy -= (fy - 0.5) * self.sh * (s - 1)
        if self.tilt:
            img = img.rotate(self.tilt, resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


class Card:
    """Imagen (p.ej. tarjeta de un bono) que entra volando con giro."""

    def __init__(self, path, x, y, w, t0, rot=0, frm=(0, 1200), border=True):
        im = Image.open(path).convert("RGB")
        im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
        r = 34
        c = Image.new("RGBA", (w + 24, im.height + 28), (0, 0, 0, 0))
        d = ImageDraw.Draw(c)
        d.rounded_rectangle([10, 14, w + 14, im.height + 18], r, fill=INK)
        c.paste(im, (0, 0), rounded_mask(im.size, r))
        if border:
            d.rounded_rectangle([0, 0, w - 1, im.height - 1], r, outline=INK, width=6)
        self.img, self.x, self.y, self.t0, self.rot, self.frm = c, x, y, t0, rot, frm

    def draw(self, canvas, t):
        ts = t - self.t0
        if ts < 0:
            return
        p = ease_back(ts / 0.5, 1.4)
        rot = self.rot + (1 - p) * 25
        im = self.img.rotate(rot, resample=Image.BICUBIC, expand=True)
        x = self.x + (1 - p) * self.frm[0]
        y = self.y + (1 - p) * self.frm[1] + math.sin(ts * 1.8 + self.x) * 6
        canvas.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))


class News:
    """Noticiero: recuadro 16:9 con grano, etiqueta del medio y frase traducida."""

    def __init__(self, clip, start, dur, cropx=542, label="", quote="", t_q=0.25):
        self.r = Reader(f"{CLIPS}/news_{clip}.mp4", start, dur + 1, (1080, 608), crop=(836, 470, cropx, 150))
        self.label = Sticker(label, 0, 0, 0.05, bg=RED, fg=WHITE, size=44, rot=-2, font="anton") if label else None
        self.quote = quote
        self.t_q = t_q
        self.qimg = None
        if quote:
            f = manrope(64)
            lines, line = [], ""
            for w in quote.split():
                tt = (line + " " + w).strip()
                if f.getlength(tt) <= 940:
                    line = tt
                else:
                    lines.append(line)
                    line = w
            lines.append(line)
            hgt = int(len(lines) * 84 + 30)
            img = Image.new("RGBA", (W, hgt), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            for k, l in enumerate(lines):
                d.text(((W - f.getlength(l)) / 2, 10 + k * 84), l, font=f, fill=(255, 226, 122))
            self.qimg = img

    def draw(self, canvas, t, i):
        fr = self.r.frame(i)
        if fr is None:
            return
        s = 1.0 + 0.05 * t  # leve acercamiento
        fr2 = fr.resize((int(1080 * s), int(608 * s)), Image.BILINEAR).crop((int(540 * s - 540), int(304 * s - 304), int(540 * s + 540), int(304 * s + 304)))
        fr2 = Image.composite(fr2, Image.new("RGB", fr2.size, (128, 128, 128)), Image.new("L", fr2.size, 238))
        canvas.paste(fr2, (0, 560))
        if self.label:
            self.label.x, self.label.y = 40 + self.label.img.width // 2, 560
            self.label.draw(canvas, t)
        if self.qimg is not None and t > self.t_q:
            a = clamp((t - self.t_q) / 0.2)
            im = self.qimg.copy()
            im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
            canvas.alpha_composite(im, (0, 1230 + int((1 - a) * 20)))


class Video:
    """Video a pantalla completa (p.ej. el hero de la landing)."""

    def __init__(self, path, start, dur, speed=1.0, crop=None):
        size = (W, H)
        self.r = Reader(path, start, dur + 1, size, crop=crop, speed=speed)

    def draw(self, canvas, t, i):
        fr = self.r.frame(i)
        if fr is not None:
            canvas.paste(fr, (0, 0))


class Logo:
    """Símbolo + 'SEYF' en Anton (marca actual), con tagline debajo."""

    def __init__(self, t0, y=820, width=760, dark=True, sub=None, sub2=None):
        sym = Image.open(f"{HERE}/assets/seyf-symbol.png").convert("RGBA")
        sym = sym.crop(sym.getbbox())
        f = anton(300)
        bb = f.getbbox("SEYF")
        sh = bb[3] - bb[1]
        sym = sym.resize((int(sym.width * sh / sym.height), sh), Image.LANCZOS)
        gap = 40
        img = Image.new("RGBA", (sym.width + gap + bb[2] - bb[0] + 10, sh + 10), (0, 0, 0, 0))
        img.alpha_composite(sym, (0, 0))
        ImageDraw.Draw(img).text((sym.width + gap - bb[0], -bb[1]), "SEYF", font=f, fill=INK if dark else WHITE)
        self.img = img.resize((width, int(img.height * width / img.width)), Image.LANCZOS)
        self.t0, self.y = t0, y
        self.sub = Kinetic([sub], t0=t0 + 0.35, size=60, y=y + self.img.height + 70, font="manrope") if sub else None
        self.sub2 = Kinetic([sub2], t0=t0 + 0.6, size=40, y=y + self.img.height + 170, font="manrope", color=(91, 85, 111)) if sub2 else None

    def draw(self, canvas, t):
        ts = t - self.t0
        if ts < 0:
            return
        p = ease_back(ts / 0.5, 1.8)
        s = 0.7 + 0.3 * p
        im = self.img.resize((int(self.img.width * s), int(self.img.height * s)), Image.LANCZOS)
        a = clamp(ts / 0.2)
        if a < 1:
            im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
        canvas.alpha_composite(im, ((W - im.width) // 2, int(self.y + (self.img.height - im.height) / 2)))
        if self.sub:
            self.sub.draw(canvas, t)
        if self.sub2:
            self.sub2.draw(canvas, t)


class Progress:
    """Barra de progreso arriba (estilo stories)."""

    def __init__(self, total):
        self.total = total

    def draw(self, canvas, t):
        d = ImageDraw.Draw(canvas)
        d.rounded_rectangle([40, 36, W - 40, 44], 4, fill=(255, 255, 255, 90))
        d.rounded_rectangle([40, 36, 40 + int((W - 80) * clamp(t / self.total)), 44], 4, fill=(255, 255, 255, 230))


class Fine:
    """Nota legal pequeña al pie."""

    def __init__(self, text, color=(91, 85, 111)):
        self.text, self.color = text, color

    def draw(self, canvas, t):
        f = manrope(26, "SemiBold")
        d = ImageDraw.Draw(canvas)
        d.text(((W - f.getlength(self.text)) / 2, H - 80), self.text, font=f, fill=self.color)


# ---------------- render ----------------
def render(name, shots, out_dir, music_seed=0, fine=None, beat_in=0.0):
    """shots: lista de dicts {d, bg, layers:[...], sfx:[(t,kind,gain)], news_audio:(clip,start,gain)}"""
    total = sum(s["d"] for s in shots)
    os.makedirs(out_dir, exist_ok=True)
    tmpv = f"{out_dir}/{name}.video.mp4"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", tmpv],
                           stdin=subprocess.PIPE)
    t_abs = 0.0
    sfx_events, news_tracks = [], []
    prev_last = None
    for si, s in enumerate(shots):
        n = int(round(s["d"] * FPS))
        bg = s.get("bg", "lav")
        base = blob_bg(bg) if isinstance(bg, str) else bg
        base_rgba = base.convert("RGBA")
        for (tt, kind, g) in s.get("sfx", []):
            sfx_events.append((t_abs + tt, kind, g))
        if s.get("cut_sfx", True) and si > 0:
            sfx_events.append((t_abs - 0.12, "whoosh", 0.55))
        if "news_audio" in s:
            clip, st, g = s["news_audio"]
            news_tracks.append((t_abs, f"{CLIPS}/news_{clip}.mp4", st, s["d"], g))
        if "audio_clip" in s:
            path, st, g = s["audio_clip"]
            news_tracks.append((t_abs, path, st, s["d"], g))
        for i in range(n):
            t = i / FPS
            canvas = base_rgba.copy()
            for L in sorted(s["layers"], key=lambda L: 0 if isinstance(L, (Phone, News, Video, Card)) else 1):
                if isinstance(L, (Phone, News, Video)):
                    L.draw(canvas, t, i)
                else:
                    L.draw(canvas, t)
            if fine:
                fine.draw(canvas, t_abs + t)
            # punch-in al inicio de cada toma (corte con energía)
            if si > 0 and t < 0.2:
                k = 1 + 0.06 * (1 - t / 0.2)
                c = canvas.resize((int(W * k), int(H * k)), Image.BILINEAR)
                canvas = c.crop(((c.width - W) // 2, (c.height - H) // 2, (c.width - W) // 2 + W, (c.height - H) // 2 + H))
            enc.stdin.write(canvas.convert("RGB").tobytes())
        for L in s["layers"]:
            if hasattr(L, "r"):
                L.r.close()
        t_abs += n / FPS
    enc.stdin.close()
    enc.wait()

    # ---------- audio ----------
    total = t_abs
    music = A.music(total + 0.2, intensity_at=beat_in)
    N = len(music)
    voice = np.zeros(N)
    for (at, path, st, d, g) in news_tracks:
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{st:.3f}", "-t", f"{d:.3f}", "-i", path, "-f", "f32le",
                                       "-ac", "1", "-ar", str(A.SR), "-"])
        x = np.frombuffer(raw, dtype=np.float32).astype(float)
        f = min(len(x), int(0.04 * A.SR))
        if f:
            x[:f] *= np.linspace(0, 1, f)
            x[-f:] *= np.linspace(1, 0, f)
        s0 = int(at * A.SR)
        e = min(N, s0 + len(x))
        voice[s0:e] += g * x[: e - s0]
    fx = np.zeros(N)
    for (at, kind, g) in sfx_events:
        x = A.SFX[kind]
        s0 = max(0, int(at * A.SR))
        e = min(N, s0 + len(x))
        fx[s0:e] += g * x[: e - s0]
    # la música baja cuando hablan los noticieros
    env = np.abs(voice)
    k = int(0.15 * A.SR)
    env = np.convolve(env, np.ones(k) / k, "same")
    duck = 1 - 0.75 * np.clip(env / 0.03, 0, 1)
    mix = music * 0.55 * duck + voice * 1.0 + fx * 0.8
    wav = f"{out_dir}/{name}.wav"
    A.write_wav(wav, mix)
    final = f"{out_dir}/{name}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmpv, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.2", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], check=True)
    os.remove(tmpv)
    os.remove(wav)
    return final, total
