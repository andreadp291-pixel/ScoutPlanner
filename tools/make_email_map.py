"""Genera la carta topografica di montagne (curve di livello) usata come sfondo, che si ripete senza cuciture.

Uso: python tools/make_email_map.py [cartella-frontend]    (serve numpy e Pillow)

Scrive:
  - frontend/public/email-map.png          sfondo delle email (colori pieni, ospitato su Pages)
  - frontend/src/assets/topo-light.png     sfondo dell'app, tema chiaro (linee verdi trasparenti)
  - frontend/src/assets/topo-dark.png      sfondo dell'app, tema scuro
  - frontend/src/assets/topo-hero.png      pannello verde dell'accesso

Il terreno è rumore con spettro 1/f^n, quindi periodico per costruzione: le curve si chiudono sui bordi della
piastrella e, ripetuta, l'immagine copre qualsiasi superficie.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw

TILE = 900          # lato della piastrella, in pixel
CELL = 3            # pixel per cella del campo
SS = 3              # supersampling per linee morbide
LEVELS = 26         # curve di livello
BG = np.array([241, 244, 239])      # #f1f4ef, lo sfondo dell'app
INK = np.array([44, 106, 74])       # #2c6a4a, il verde dell'app
SEED = 11


def terrain(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    f = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    f[0, 0] = 1
    amp = f ** (-1.35)          # spettro ~1/f^2.7: grandi masse con dettagli di crinale
    amp[0, 0] = 0
    z = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * amp))
    z = (z - z.min()) / (z.max() - z.min())
    return z ** 1.25            # vette un po' più ripide e valli più larghe


def segments(z: np.ndarray, level: float):
    """Marching squares sul campo periodico: segmenti (x0, y0, x1, y1) in coordinate di cella."""
    a = z
    b = np.roll(z, -1, axis=1)               # angolo destro
    c = np.roll(np.roll(z, -1, axis=0), -1, axis=1)
    d = np.roll(z, -1, axis=0)               # angolo in basso
    idx = (a > level) * 1 + (b > level) * 2 + (c > level) * 4 + (d > level) * 8

    def lerp(v0, v1):
        return (level - v0) / (v1 - v0 + 1e-12)

    out = []
    ys, xs = np.nonzero((idx != 0) & (idx != 15))
    for y, x in zip(ys, xs):
        va, vb, vc, vd = a[y, x], b[y, x], c[y, x], d[y, x]
        top = (x + lerp(va, vb), y)
        right = (x + 1, y + lerp(vb, vc))
        bottom = (x + lerp(vd, vc), y + 1)
        left = (x, y + lerp(va, vd))
        table = {
            1: [(left, top)], 14: [(left, top)], 2: [(top, right)], 13: [(top, right)],
            3: [(left, right)], 12: [(left, right)], 4: [(right, bottom)], 11: [(right, bottom)],
            6: [(top, bottom)], 9: [(top, bottom)], 7: [(left, bottom)], 8: [(left, bottom)],
            5: [(left, top), (right, bottom)], 10: [(top, right), (bottom, left)],
        }
        for p, q in table[int(idx[y, x])]:
            out.append((p[0], p[1], q[0], q[1]))
    return out


def lines_mask() -> np.ndarray:
    """Intensità delle linee, 0..1: le curve normali leggere, ogni quinta più marcata come sulle carte vere."""
    n = TILE // CELL
    z = terrain(n, SEED)
    size = TILE * SS
    img = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(img)
    k = size / n
    for i in range(1, LEVELS):
        index = i % 5 == 0
        value = int(255 * (0.26 if index else 0.13))
        width = SS * (2 if index else 1)
        for x0, y0, x1, y1 in segments(z, i / LEVELS):
            draw.line((x0 * k, y0 * k, x1 * k, y1 * k), fill=value, width=width)
    return np.asarray(img.resize((TILE, TILE), Image.LANCZOS), dtype=np.float32) / 255.0


def overlay(mask: np.ndarray, color, strength: float) -> Image.Image:
    """Linee di un colore su sfondo trasparente: va steso sopra lo sfondo del tema."""
    rgba = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    rgba[..., :3] = color
    rgba[..., 3] = np.clip(mask * strength * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main(frontend: str) -> None:
    mask = lines_mask()
    # email: colori pieni (i client di posta non gestiscono bene la trasparenza dei fondi)
    email = (BG[None, None, :] * (1 - mask[..., None]) + INK[None, None, :] * mask[..., None]).astype(np.uint8)
    out = os.path.join(frontend, "public", "email-map.png")
    Image.fromarray(email, "RGB").quantize(colors=24).save(out, optimize=True)
    print(out)
    # app: linee trasparenti per tema. mask vale 0.13 / 0.26 (curve normali / marcate): "strength" la scala
    assets = os.path.join(frontend, "src", "assets")
    os.makedirs(assets, exist_ok=True)
    for name, color, strength in (
        ("topo-light.png", INK, 1.0),                    # verde dell'app
        ("topo-dark.png", (108, 199, 149), 0.9),         # verde chiaro del tema scuro
        ("topo-hero.png", (223, 240, 228), 0.55),        # chiaro sul pannello verde scuro dell'accesso
    ):
        path = os.path.join(assets, name)
        overlay(mask, color, strength).quantize(colors=32, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
        print(path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "frontend"))
