"""Genera los íconos de la app (icon-192.png e icon-512.png). Uso: python tools/hacer_iconos.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
VERDE = (46, 125, 50)


def icono(tam):
    img = Image.new("RGB", (tam, tam), VERDE)
    d = ImageDraw.Draw(img)
    # balanza: plato blanco con aguja
    m = tam // 2
    r = int(tam * 0.32)
    d.rounded_rectangle([m - r, int(tam * 0.22), m + r, int(tam * 0.78)], radius=int(tam * 0.08), fill="white")
    d.pieslice([m - int(r * 0.7), int(tam * 0.28), m + int(r * 0.7), int(tam * 0.28) + int(r * 1.4)], 200, 340, fill=VERDE)
    try:
        f = ImageFont.truetype("arialbd.ttf", int(tam * 0.18))
    except OSError:
        f = ImageFont.load_default()
    d.text((m, int(tam * 0.64)), "kg", fill=VERDE, font=f, anchor="mm")
    img.save(RAIZ / f"icon-{tam}.png")


if __name__ == "__main__":
    for t in (192, 512):
        icono(t)
