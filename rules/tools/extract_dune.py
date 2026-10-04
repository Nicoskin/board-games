"""Вырезки для правил «Дюны»: символы (с прозрачностью) и иллюстрации из буклетов."""
import io, os, json
import pymupdf
from PIL import Image

SRC = 'M:/Downloads/'
OUT = 'M:/Documents/0__AI/Score calculation/rules/img/dune/'
os.makedirs(OUT + 'icons', exist_ok=True)
os.makedirs(OUT + 'cells', exist_ok=True)
docs = {
    'page': pymupdf.open(SRC + 'duna-imperija-vosstanie-rules.pdf'),
    'six': pymupdf.open(SRC + 'duna-imperija-vosstanie-6-players-rules.pdf'),
    'ref': pymupdf.open(SRC + 'duna-imperija-vosstanie-spravochnik-jacheek (1).pdf'),
    'solo': pymupdf.open(SRC + 'duna-imperija-vosstanie-1-2-players-rules.pdf'),
}
sizes = {}


def rgba(doc, xref):
    info = doc.extract_image(xref)
    im = Image.open(io.BytesIO(info['image'])).convert('RGBA')
    if info.get('smask'):
        m = Image.open(io.BytesIO(doc.extract_image(info['smask'])['image'])).convert('L')
        if m.size != im.size:
            m = m.resize(im.size, Image.LANCZOS)
        im.putalpha(m)
    return im


def icon(name, key, pn, x, y):
    doc = docs[key]; p = doc[pn - 1]; s = 1000 / p.rect.width
    best = None
    for i in p.get_image_info(xrefs=True):
        b = [v * s for v in i['bbox']]
        d = abs(b[0] - x) + abs(b[1] - y)
        if best is None or d < best[0]:
            best = (d, i)
    if best[0] > 8:
        print('!! not found', name, best[0]); return
    im = rgba(doc, best[1]['xref'])
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.save(OUT + 'icons/' + name + '.png', optimize=True)
    sizes['icons/' + name + '.png'] = im.size


def crop(name, key, pn, box, width=None, sub=''):
    p = docs[key][pn - 1]; s = p.rect.width / 1000
    r = pymupdf.Rect(box[0] * s, box[1] * s, box[2] * s, box[3] * s)
    z = 2.4 / s * 1.0
    pix = p.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=r, alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT + sub + name + '.jpg', quality=84, optimize=True, progressive=True)
    sizes[sub + name + '.jpg'] = im.size
    return im


# ---------- символы ----------
P20 = {
    'agent': (33, 66), 'wall': (34, 158), 'sym-crys': (33, 202), 'sym-mouse': (33, 223), 'sym-thopter': (33, 243),
    'sym-wild': (47, 266), 'bonus': (34, 317), 'recall-agent': (34, 441), 'recall-spy': (34, 505),
    'intrigue': (34, 556), 'draw': (34, 613), 'uprising': (34, 672), 'signet': (34, 716), 'contract': (34, 768),
    'control': (34, 814), 'steal': (34, 882), 'hook': (34, 930), 'sword': (531, 55), 'troop': (531, 111),
    'persuasion': (531, 190), 'worm': (531, 237), 'vp': (531, 296), 'maker': (531, 339),
    'inf-emperor': (531, 383), 'inf-guild': (572, 383), 'inf-bg': (614, 383), 'inf-fremen': (655, 383),
    'inf-any1': (531, 424), 'inf-any2': (572, 424), 'inf-lose': (614, 424),
    'solari': (531, 474), 'spice': (572, 474), 'water': (619, 474), 'discard': (531, 513),
    'trash-intrigue': (531, 763), 'trash': (531, 822), 'spy': (531, 885),
}
for n, (x, y) in P20.items():
    icon(n, 'page', 20, x, y)
for n, y in zip(['a-emperor', 'a-guild', 'a-bg', 'a-fremen', 'a-landsraad', 'a-city', 'a-spice', 'a-spy'],
                [114, 143, 172, 201, 230, 259, 288, 317]):
    icon(n, 'page', 9, 605, y)

# ---------- иллюстрации ----------
crop('round', 'page', 8, (20, 108, 990, 228), 1400)
crop('card-anatomy', 'page', 8, (455, 655, 962, 902), 1100)
crop('faction-track', 'page', 7, (820, 232, 962, 508))
crop('intrigue-types', 'page', 7, (652, 748, 978, 918), 900)
crop('conflict-zone', 'page', 10, (310, 515, 499, 609))
crop('wall-locations', 'page', 10, (793, 453, 942, 607))
crop('control-flag', 'page', 10, (795, 180, 942, 268))
crop('observation-post', 'page', 11, (410, 95, 534, 270))
crop('combat-track', 'page', 12, (510, 731, 724, 795))
crop('conflict-card', 'page', 14, (28, 308, 157, 497))
crop('battle-symbols', 'page', 14, (272, 762, 418, 818))
crop('double-reward', 'page', 14, (860, 841, 967, 909))
crop('solo-vp', 'solo', 3, (735, 158, 848, 308))
crop('six-agents', 'six', 3, (470, 170, 572, 242))
crop('six-boards', 'six', 3, (633, 108, 947, 302), 900)
crop('six-team-reward', 'six', 8, (30, 152, 98, 222))
crop('six-exchange', 'six', 8, (528, 62, 592, 132))
crop('six-reinforce', 'six', 8, (528, 148, 592, 212))
crop('six-muaddib', 'six', 8, (30, 66, 98, 110))
crop('six-shaddam', 'six', 8, (30, 111, 98, 152))

# разворот подготовки: правая часть с. 4 + левая часть с. 5
a = crop('_a', 'page', 4, (440, 280, 1000, 1000)); b = crop('_b', 'page', 5, (0, 280, 420, 1000))
sp = Image.new('RGB', (a.width + b.width, a.height)); sp.paste(a, (0, 0)); sp.paste(b, (a.width, 0))
sp = sp.resize((1600, round(sp.height * 1600 / sp.width)), Image.LANCZOS)
sp.save(OUT + 'setup.jpg', quality=82, optimize=True, progressive=True); sizes['setup.jpg'] = sp.size
for t in ('_a', '_b'):
    os.remove(OUT + t + '.jpg'); sizes.pop(t + '.jpg')

# ---------- картинки ячеек: крупные изображения на страницах справочника ----------
cells = {}
for key, pn in (('ref', 1), ('ref', 2), ('six', 8)):
    p = docs[key][pn - 1]; s = 1000 / p.rect.width
    boxes = []
    for i in p.get_image_info():
        b = [v * s for v in i['bbox']]
        w, h = b[2] - b[0], b[3] - b[1]
        if 90 < w < 200 and 60 < h < 140:
            boxes.append(b)
    # сливаем вложенные/пересекающиеся
    merged = []
    for b in sorted(boxes, key=lambda b: -(b[2] - b[0]) * (b[3] - b[1])):
        if not any(b[0] >= m[0] - 3 and b[1] >= m[1] - 3 and b[2] <= m[2] + 3 and b[3] <= m[3] + 3 for m in merged):
            merged.append(b)
    merged.sort(key=lambda b: (b[0] > 450, b[1]))
    cells[f'{key}-{pn}'] = [[round(v) for v in b] for b in merged]
    for n, b in enumerate(merged):
        crop(f'{key}{pn}-{n:02d}', key, pn, b, sub='cells/')

json.dump(sizes, open(OUT + '_sizes.json', 'w'), indent=0)
print(json.dumps(cells))
print(len(sizes), 'files')

# ---------- полные страницы поменьше ----------
for f in os.listdir(OUT):
    if f.endswith('.jpg') and f[:4] in ('page', 'six-', 'ref-', 'solo') and not f.endswith('-m.jpg') and f[-6:-4].isdigit():
        im = Image.open(OUT + f)
        if im.width > 1600:
            im = im.resize((1600, 1600), Image.LANCZOS); im.save(OUT + f, quality=76, optimize=True, progressive=True)
