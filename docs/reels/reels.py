"""Guiones de los reels (ES / EN). Uso: python3 reels.py [nombre ...] [--lang es|en]
Salida: out/seyf-reel-<nombre>-<lang>.mp4"""
import os
import sys

from compose import (INK, LIME, VIOLET, WHITE, RED, Card, Fine, Kinetic, Logo, News, Phone, Sticker, Video, render, CLIPS)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/out"
EF = os.path.abspath(f"{HERE}/../pitch-video/etherfuse")
PW, PY = 600, 520  # ancho y posición del teléfono


def P(clip, a, b, d, enter=None, **kw):
    """Teléfono mostrando clip[a..b] comprimido a d segundos."""
    return Phone(clip, a, d, width=PW, y=PY, speed=(b - a) / d, enter=enter, **kw)


def K(lines, t0=0.05, size=120, y=150, **kw):
    return Kinetic(lines, t0=t0, size=size, y=y, **kw)


def end_card(L, d=2.6):
    return {"d": d, "bg": "lime", "sfx": [(0.0, "impact", 0.7)], "layers": [
        Logo(0.05, y=700, width=720, sub=[L["tag1"], (L["tag2"], "v")], sub2=[L["cta"]])]}


# ---------- textos ----------
T = {
    "es": dict(
        tag1="Tu dinero.", tag2="Siempre rindiendo.", cta="Link en bio",
        fine="Montos ilustrativos · Rendimientos no garantizados",
        fine_adv="Beta en testnet · Montos ilustrativos",
        q_mx="“Hoy la pensión garantizada ya no existe para las nuevas generaciones.”",
        q_fox="“El trabajador promedio en EE.UU. solo tiene $955 ahorrados para su retiro.”",
        q_cbs="“El Seguro Social podría quedarse sin fondos en menos de 10 años.”",
        q_mvs="“…es una bomba, y va a explotar…”",
        q_fr="“…subir la edad de retiro de 62 a 64.”",
        q_cl="“…la crisis de pensiones dejó a muchos jubilados bajo la línea de pobreza.”",
        l_mx="MÉXICO", l_us="EE.UU.", l_fr="FRANCIA", l_cl="CHILE",
    ),
    "en": dict(
        tag1="Your money.", tag2="Always earning.", cta="Link in bio",
        fine="Illustrative amounts · Returns not guaranteed",
        fine_adv="Testnet beta · Illustrative amounts",
        q_mx="“Today, the guaranteed pension no longer exists for new generations.”",
        q_fox="“The average US worker only has $955 saved for retirement.”",
        q_cbs="“Social Security could run out of funds… in less than 10 years.”",
        q_mvs="“…it's a bomb, and it's going to explode…”",
        q_fr="“…raising the pension age from 62 to 64.”",
        q_cl="“…the pension crisis has left many retirees below the poverty line.”",
        l_mx="MEXICO", l_us="UNITED STATES", l_fr="FRANCE", l_cl="CHILE",
    ),
}


def news(L, key, clip, start, d, quote_key, label_key, top=None):
    layers = [News(clip, start, d, label=L[label_key], quote=L[quote_key])]
    if top:
        layers.append(K(top, size=110, y=200, color=WHITE))
    return {"d": d, "bg": "ink", "layers": layers, "news_audio": (clip, start, 0.9), "sfx": [(0, "glitch", 0.5)]}


# ---------- 1. Bóveda ----------
def reel_boveda(lang):
    L = T[lang]
    es = lang == "es"
    shots = [
        {"d": 1.7, "bg": "ink", "layers": [
            K([["¿Tu", "ahorro"], [("rinde", "l"), ("0%?", "hr")]] if es else [["Your", "savings"], [("earning", "l"), ("0%?", "hr")]],
              size=190, y=640, color=WHITE)], "sfx": [(0.05, "pop", 0.6), (0.35, "pop", 0.6)]},
        news(L, "mx", "mx", 0.3, 2.6, "q_mx", "l_mx", top=[["Mientras", "tanto…"]] if es else [["Meanwhile…"]]),
        {"d": 3.0, "layers": [
            K([[("Crea", "hl"), "una"], ["bóveda"]] if es else [[("Create", "hl"), "a"], ["vault"]]),
            P("boveda", 1.5, 7.3, 3.0, enter="up")], "sfx": [(0.9, "tick", 0.6), (2.0, "tick", 0.6)]},
        {"d": 2.6, "layers": [
            K([["Elige", ("CETES", "hv")]] if es else [["Pick", ("CETES", "hv")]], size=130),
            K([["Bonos del gobierno de México"]] if es else [["Mexican government bonds"]], font="manrope", size=46, y=330, t0=0.3),
            P("boveda", 6.8, 10.0, 2.6, zoom=(0.4, 2.2, 1.35, 0.5, 0.42)),
            Sticker("Riesgo bajo" if es else "Low risk", 840, 1140, 1.1, bg=LIME)], "sfx": [(1.1, "pop", 0.7)]},
        {"d": 3.2, "layers": [
            K([[("Abona", "hl"), "lo"], ["que", "quieras"]] if es else [[("Add", "hl"), "any"], ["amount"]]),
            P("boveda", 13.4, 18.6, 3.2),
            Sticker("+$1,000", 230, 1080, 1.4, bg=WHITE, rot=5, size=64)], "sfx": [(1.4, "pop", 0.7)]},
        {"d": 3.0, "layers": [
            K([["y", "rinde"], [("todos", "hv"), ("los", "hv"), ("días", "hv")]] if es else [["and", "it", "earns"], [("every", "hv"), ("day", "hv")]]),
            P("boveda", 1.6, 4.1, 3.0, zoom=(0.3, 3.5, 1.4, 0.5, 0.16))], "sfx": [(0.6, "coin", 0.8)]},
        {"d": 2.0, "layers": [
            K([["Sin", "comisiones."], [("Sin", "v"), ("letras", "v"), ("chiquitas.", "v")]] if es else [["No", "fees."], [("No", "v"), ("fine", "v"), ("print.", "v")]], size=100, y=760)],
         "sfx": [(0.05, "pop", 0.5)]},
        end_card(L),
    ]
    return shots, L["fine"]


# ---------- 2. Adelanto ----------
def reel_adelanto(lang):
    L = T[lang]
    es = lang == "es"
    shots = [
        news(L, "fox", "fox", 0.4, 3.0, "q_fox", "l_us", top=[["$955", "de", "ahorro"]] if es else [["$955", "in", "savings"]]),
        {"d": 1.8, "bg": "ink", "layers": [
            K([["¿Una", "emergencia"], [("hoy?", "hr")]] if es else [["An", "emergency"], [("today?", "hr")]], size=170, y=660, color=WHITE)],
         "sfx": [(0.05, "pop", 0.6)]},
        {"d": 2.8, "layers": [
            K([[("Adelanta", "hl")], ["tu", "rendimiento"]] if es else [[("Advance", "hl")], ["your", "yield"]]),
            P("adelanto", 0.0, 4.1, 2.8, enter="up")], "sfx": [(1.0, "tick", 0.5)]},
        {"d": 2.6, "layers": [
            K([["Tú", "eliges", "el"], [("plazo", "hv")]] if es else [["You", "pick", "the"], [("term", "hv")]]),
            P("adelanto", 4.0, 6.2, 2.6, zoom=(0.2, 2.2, 1.45, 0.5, 0.55)),
            Sticker("7 a 365 días" if es else "7 to 365 days", 800, 1250, 0.7, bg=LIME, rot=4)], "sfx": [(0.7, "pop", 0.7)]},
        {"d": 3.0, "layers": [
            K([["sin", "vender"], [("tu", "l"), ("ahorro", "hl")]] if es else [["without", "selling"], [("your", "l"), ("savings", "hl")]]),
            P("adelanto", 6.2, 10.4, 3.0)], "sfx": [(2.6, "tick", 0.6)]},
        {"d": 2.6, "layers": [
            K([[("Listo.", "hl")]] if es else [[("Done.", "hl")]], size=150),
            P("adelanto", 10.4, 12.7, 2.6, zoom=(0.3, 3.0, 1.2, 0.5, 0.4)),
            Sticker("Adelanto recibido" if es else "Advance received", "c", 1500, 0.6, bg=WHITE, rot=-3)],
         "sfx": [(0.4, "coin", 0.8)]},
        end_card(L),
    ]
    return shots, L["fine_adv"]


# ---------- 3. CETES ----------
def reel_cetes(lang):
    L = T[lang]
    es = lang == "es"
    shots = [
        {"d": 2.0, "bg": "ink", "layers": [
            K([["Lo", "que", "tu", "cuenta"], ["no", "te", "dice:"]] if es else [["What", "your", "bank"], ["won't", "tell", "you:"]], size=120, y=700, color=WHITE)],
         "sfx": [(0.05, "pop", 0.5)]},
        {"d": 2.2, "bg": "ink", "layers": [
            K([[("CETES", "hl")], ["rinden", "más"]] if es else [[("CETES", "hl")], ["pay", "more"]], size=210, y=620, color=WHITE)],
         "sfx": [(0.05, "impact", 0.6)]},
        news(L, "cbs", "cbs", 0.3, 2.4, "q_cbs", "l_us", top=[["¿Y", "tu", "retiro?"]] if es else [["And", "your", "retirement?"]]),
        {"d": 2.4, "layers": [
            K([["Desde", "tu", "cel"]] if es else [["From", "your", "phone"]], size=130),
            K([["Bonos del gobierno de México, tokenizados"]] if es else [["Mexican government bonds, tokenized"]], font="manrope", size=42, y=330, t0=0.3),
            P("abonar", 0.0, 3.0, 2.4, enter="up")], "sfx": [(1.4, "tick", 0.5)]},
        {"d": 2.8, "layers": [
            K([["En", ("segundos", "hl")]] if es else [["In", ("seconds", "hl")]], size=140),
            P("abonar", 3.0, 7.0, 2.8, zoom=(0.4, 2.4, 1.3, 0.5, 0.6))], "sfx": [(0.6, "pop", 0.6)]},
        {"d": 3.2, "layers": [
            K([["Tu", "bóveda"], [("crece", "hv"), ("sola", "hv")]] if es else [["Your", "vault"], [("grows", "hv"), ("itself", "hv")]]),
            P("abonar", 7.0, 12.0, 3.2),
            Sticker("Rinde diario" if es else "Daily yield", 830, 1180, 1.0, bg=LIME)], "sfx": [(0.5, "coin", 0.8), (1.0, "pop", 0.6)]},
        {"d": 2.0, "layers": [
            K([["Retira", "cuando"], [("quieras", "hl")]] if es else [["Withdraw", "any"], [("time", "hl")]], size=120, y=760)],
         "sfx": [(0.05, "pop", 0.5)]},
        end_card(L),
    ]
    return shots, L["fine"]


# ---------- 4. Stable bonds ----------
def reel_bonos(lang):
    L = T[lang]
    es = lang == "es"
    names = {"MX": "CETES", "BR": "TESOURO", "US": "USTRY", "UK": "GILTS", "EU": "EUROB"}
    cards = []
    pos = [(300, 900, -8), (780, 820, 7), (290, 1350, 5), (790, 1300, -6), (540, 1110, -2)]
    for k, (c, (x, y, r)) in enumerate(zip(["MX", "BR", "US", "UK", "EU"], pos)):
        cards.append(Card(f"{EF}/{c}.jpg", x, y, 330, 0.15 + k * 0.32, rot=r, frm=((-1 if x < 540 else 1) * 700, 300)))
    labels = [Sticker(names[c], x, y + 230, 0.45 + k * 0.32, bg=LIME if k % 2 == 0 else WHITE, size=40, rot=r, font="anton")
              for k, (c, (x, y, r)) in enumerate(zip(["MX", "BR", "US", "UK", "EU"], pos))]
    shots = [
        {"d": 2.4, "bg": "ink", "layers": [
            K([["¿Ahorrar", "en"], [("dólares", "l"), ("o", "w"), ("pesos?", "l")]] if es else [["Save", "in"], [("dollars", "l"), ("or", "w"), ("pesos?", "l")]], size=150, y=620, color=WHITE),
            K([["¿Por qué no en los dos?"]] if es else [["Why not both?"]], font="manrope", size=56, y=1000, t0=1.2, color=WHITE)],
         "sfx": [(0.05, "pop", 0.5), (1.2, "pop", 0.5)]},
        {"d": 3.6, "layers": [
            K([[("Bonos", "hl"), "de"], ["5", "países"]] if es else [[("Bonds", "hl"), "from"], ["5", "countries"]]),
            *cards, *labels], "sfx": [(0.15 + k * 0.32, "pop", 0.6) for k in range(5)]},
        {"d": 3.0, "layers": [
            K([["En", "tu", "wallet"]] if es else [["In", "your", "wallet"]], size=130),
            K([["Stablebonds de Etherfuse en Stellar"]] if es else [["Etherfuse stablebonds on Stellar"]], font="manrope", size=42, y=330, t0=0.3),
            P("wallet", 0.0, 4.6, 3.0, enter="up")], "sfx": [(1.2, "tick", 0.5)]},
        {"d": 2.6, "layers": [
            K([[("Brasil", "hv"), ("·", None), ("EE.UU.", "hl")]] if es else [[("Brazil", "hv"), ("·", None), ("USA", "hl")]], size=120),
            P("wallet", 4.0, 7.2, 2.6, zoom=(0.2, 2.6, 1.25, 0.5, 0.3))], "sfx": [(0.3, "pop", 0.5)]},
        {"d": 2.0, "layers": [
            K([["Todo", "en", "una"], [("sola", "hl"), ("app", "hl")]] if es else [["All", "in"], [("one", "hl"), ("app", "hl")]], size=130, y=760)],
         "sfx": [(0.05, "pop", 0.5)]},
        end_card(L),
    ]
    return shots, ("Activos tokenizados por Etherfuse · Montos ilustrativos" if es else "Assets tokenized by Etherfuse · Illustrative amounts")


# ---------- 5. Noticias → app ----------
def reel_noticias(lang):
    L = T[lang]
    es = lang == "es"
    shots = [
        news(L, "cbs", "cbs", 0.3, 2.1, "q_cbs", "l_us", top=[["La", "crisis…"]] if es else [["The", "crisis…"]]),
        news(L, "mvs", "mvs", 0.6, 1.7, "q_mvs", "l_mx", top=[["…del", "retiro…"]] if es else [["…of", "retirement…"]]),
        news(L, "fr", "fr", 0.2, 1.8, "q_fr", "l_fr", top=[["…es"], ["global…"]] if es else [["…is"], ["global…"]]),
        news(L, "cl", "cl", 0.6, 2.2, "q_cl", "l_cl", top=[["…y", ("crece.", "hr")]] if es else [["…and", ("growing.", "hr")]]),
        {"d": 1.8, "bg": "ink", "layers": [
            K([["El", "retiro"], [("está", "hr"), ("roto.", "hr")]] if es else [["Retirement"], [("is", "hr"), ("broken.", "hr")]], size=180, y=650, color=WHITE)],
         "sfx": [(0.05, "impact", 0.8)], "cut_sfx": False},
        {"d": 2.2, "bg": "ink", "layers": [
            Video(f"{CLIPS}/landing_hero.mp4", 3.2, 2.2)], "sfx": [(0.0, "whoosh", 0.6)]},
        {"d": 2.4, "layers": [
            K([["Ahorra", "en"], [("bóvedas", "hl")]] if es else [["Save", "in"], [("vaults", "hl")]]),
            P("boveda", 16.0, 21.0, 2.4, enter="up")], "sfx": [(0.8, "coin", 0.7)]},
        {"d": 2.4, "layers": [
            K([["Adelanta", "tu"], [("rendimiento", "hv")]] if es else [["Advance", "your"], [("yield", "hv")]]),
            P("adelanto", 4.0, 7.5, 2.4)], "sfx": [(0.5, "tick", 0.5)]},
        {"d": 2.2, "layers": [
            K([["Bonos", "de"], [("5", "hl"), ("países", "hl")]] if es else [["Bonds", "from"], [("5", "hl"), ("countries", "hl")]]),
            P("wallet", 1.8, 5.5, 2.2)], "sfx": [(0.5, "pop", 0.5)]},
        {"d": 1.8, "layers": [
            K([["No", "esperes"], [("al", "v"), ("retiro.", "v")]] if es else [["Don't", "wait"], [("for", "v"), ("retirement.", "v")]], size=140, y=720)],
         "sfx": [(0.05, "pop", 0.5)]},
        end_card(L),
    ]
    # el beat entra cuando termina la ráfaga de noticieros
    return shots, L["fine"], 2.1 + 1.7 + 1.8 + 2.2 + 1.8


REELS = {"boveda": reel_boveda, "adelanto": reel_adelanto, "cetes": reel_cetes, "bonos": reel_bonos, "noticias": reel_noticias}

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    langs = ["es", "en"]
    for a in sys.argv[1:]:
        if a.startswith("--lang="):
            langs = [a.split("=")[1]]
    for name in args or list(REELS):
        for lang in langs:
            res = REELS[name](lang)
            shots, fine = res[0], res[1]
            beat = res[2] if len(res) > 2 else 0.0
            path, dur = render(f"seyf-reel-{name}-{lang}", shots, OUT, fine=Fine(fine), beat_in=beat)
            print("ok", path, f"{dur:.1f}s", flush=True)
