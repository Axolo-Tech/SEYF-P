"""Música y efectos sintetizados (numpy), sin servicios externos.
Pista pop-electrónica a 120 bpm con bombo, clap, hats, bajo y acordes "pluck",
más efectos: whoosh, pop, coin, tick, impacto y riser."""
import numpy as np
import wave

SR = 48000
rng = np.random.default_rng(7)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def env_ad(n, a, d):
    e = np.ones(n)
    a = max(1, int(a * SR))
    e[:a] = np.linspace(0, 1, a)
    e[a:] = np.exp(-np.arange(n - a) / (d * SR))
    return e


def lowpass(x, cutoff):
    # un polo, suficiente para suavizar
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    """Lowpass vía FFT (rápido para señales largas)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def kick():
    t = t_(0.45)
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.sin(ph * 2) * np.exp(-t * 30)


def clap():
    n = rng.standard_normal(int(0.25 * SR))
    n = hp_fast(lp_fast(n, 4500), 900)
    e = np.zeros_like(n)
    for k, off in enumerate([0, 0.012, 0.024]):
        s = int(off * SR)
        e[s:] += env_ad(len(n) - s, 0.001, 0.05 if k < 2 else 0.11)[: len(n) - s]
    return n * e * 0.6


def hat(open_=False):
    n = hp_fast(rng.standard_normal(int(0.2 * SR)), 7000)
    return n * env_ad(len(n), 0.001, 0.08 if open_ else 0.022) * 0.35


def saw(freq, sec, detune=0.0):
    t = t_(sec)
    out = np.zeros_like(t)
    for d in (-detune, 0, detune):
        ph = (t * freq * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / 3


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def music(seconds, bpm=120, intensity_at=None, seed_key=0):
    """Pista completa. `intensity_at`: segundos donde entra el beat completo (antes, solo pad)."""
    beat = 60 / bpm
    N = int(seconds * SR) + SR
    mix = np.zeros(N)
    K, C, H, HO = kick(), clap(), hat(), hat(True)
    full_from = intensity_at if intensity_at is not None else 0

    # progresión en La menor: Am - F - C - G (raíces MIDI)
    prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]
    bar = 4 * beat
    n_beats = int(seconds / beat) + 1

    def put(sig, at, g=1.0):
        s = int(at * SR)
        if s >= N:
            return
        e = min(N, s + len(sig))
        mix[s:e] += g * sig[: e - s]

    for b in range(n_beats):
        at = b * beat
        full = at >= full_from
        if full:
            put(K, at, 0.95)
            if b % 2 == 1:
                put(C, at, 0.8)
            put(H, at + beat / 2, 0.55)
            if b % 4 == 3:
                put(HO, at + beat * 0.75, 0.4)
            put(H, at + beat / 4, 0.18)
    # bajo + acordes pluck (con sidechain)
    t_bar = 0.0
    i = 0
    while t_bar < seconds:
        root, chord = prog[i % 4]
        for k in range(8):  # corcheas
            at = t_bar + k * beat / 2
            if at >= seconds:
                break
            full = at >= full_from
            if full:
                bs = lp_fast(saw(note(root - 12), beat / 2 * 0.95, 0.004), 380)
                put(bs * env_ad(len(bs), 0.004, 0.18) * 0.55, at)
            # pluck: acorde arpegiado cada corchea
            m = chord[k % 3] + (12 if k % 4 == 3 else 0)
            pl = lp_fast(saw(note(m + 12), 0.4, 0.006), 2600)
            put(pl * env_ad(len(pl), 0.002, 0.12) * (0.20 if full else 0.13), at)
        # pad suave
        pad = sum(np.sin(2 * np.pi * note(m) * t_(bar)) for m in chord)
        pad *= env_ad(len(pad), 0.4, 3.0) * 0.05
        put(pad, t_bar)
        t_bar += bar
        i += 1

    # sidechain: baja todo lo que no es bombo ~120 ms tras cada beat
    sc = np.ones(N)
    for b in range(n_beats):
        at = b * beat
        if at < full_from:
            continue
        s = int(at * SR)
        n = int(0.22 * SR)
        e = min(N, s + n)
        sc[s:e] = np.minimum(sc[s:e], 0.45 + 0.55 * (np.arange(e - s) / n) ** 1.5)
    # aplica sidechain a todo y re-suma el bombo limpio
    kick_track = np.zeros(N)
    for b in range(n_beats):
        at = b * beat
        if at >= full_from:
            s = int(at * SR)
            e = min(N, s + len(K))
            kick_track[s:e] += 0.95 * K[: e - s]
    mix = (mix - kick_track) * sc + kick_track
    mix = mix[: int(seconds * SR)]
    fade = int(1.2 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    return np.tanh(mix * 0.9) * 0.8


# ---------------- efectos ----------------
def whoosh(d=0.45):
    n = rng.standard_normal(int(d * SR))
    t = np.linspace(0, 1, len(n))
    # barrido de filtro hacia arriba
    out = np.zeros_like(n)
    for k, c in enumerate(np.linspace(400, 6000, 6)):
        seg = slice(int(k * len(n) / 6), int((k + 1) * len(n) / 6))
        out[seg] = lp_fast(n, c)[seg]
    return out * np.sin(np.pi * t) ** 2 * 0.7


def pop():
    t = t_(0.12)
    f = 900 * np.exp(-t * 18) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.6


def tick():
    t = t_(0.05)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120) * 0.4


def coin():
    t = t_(0.6)
    s = np.sin(2 * np.pi * 1975 * t) * np.exp(-t * 7)
    s[int(0.07 * SR):] += (np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 6))[: len(s) - int(0.07 * SR)]
    return s * 0.35


def impact():
    t = t_(1.6)
    f = 40 + 80 * np.exp(-t * 12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.8)
    nz = lp_fast(rng.standard_normal(len(t)), 1800) * np.exp(-t * 9) * 0.5
    return (body + nz) * 0.9


def riser(d=1.6):
    t = t_(d)
    n = rng.standard_normal(len(t))
    out = hp_fast(n, 500) * (t / d) ** 2 * 0.35
    out += np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / d) ** 2) / SR) * (t / d) ** 2 * 0.15
    return out


def glitch(d=0.25):
    n = rng.standard_normal(int(d * SR))
    gate = (np.sin(np.linspace(0, 60, len(n))) > 0).astype(float)
    return n * gate * 0.3


SFX = {"whoosh": whoosh(), "pop": pop(), "tick": tick(), "coin": coin(), "impact": impact(),
       "riser": riser(), "glitch": glitch()}


def write_wav(path, x):
    x = np.asarray(x, dtype=float)
    peak = np.abs(x).max() + 1e-9
    if peak > 0.98:
        x = x / peak * 0.98
    st = x if x.ndim == 2 else np.repeat(x[:, None], 2, axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
