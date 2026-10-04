import os, json, sys
sys.argv=['x']
import importlib.util, pymupdf
from PIL import Image
OUT='M:/Documents/0__AI/Score calculation/rules/img/dune/'
SRC='M:/Downloads/'
docs={'page':pymupdf.open(SRC+'duna-imperija-vosstanie-rules.pdf'),'six':pymupdf.open(SRC+'duna-imperija-vosstanie-6-players-rules.pdf'),'ref':pymupdf.open(SRC+'duna-imperija-vosstanie-spravochnik-jacheek (1).pdf'),'solo':pymupdf.open(SRC+'duna-imperija-vosstanie-1-2-players-rules.pdf')}
sizes=json.load(open(OUT+'_sizes.json'))
def crop(name,key,pn,box,width=None,sub=''):
    p=docs[key][pn-1]; s=p.rect.width/1000
    r=pymupdf.Rect(*[v*s for v in box]); z=2.4/s
    pix=p.get_pixmap(matrix=pymupdf.Matrix(z,z),clip=r,alpha=False)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    if width and im.width>width: im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(OUT+sub+name+'.jpg',quality=84,optimize=True,progressive=True); sizes[sub+name+'.jpg']=im.size
crop('card-anatomy','page',8,(460,650,960,975),1100)
crop('conflict-zone','page',10,(312,517,497,603))
crop('six-team-reward','six',8,(30,152,128,222))
crop('solo-vp','solo',3,(722,156,848,308))
names={'ref1':['arrakeen','dutiful-service','desert-tactics','assembly-hall','imperial-basin','accept-contract'],
'ref2':['research-station','swordmaster','gather-support','shipping','imperial-privilege','sardaukar','sietch-tabr','spice-refinery','deliver-supplies','secrets','fremkit','heighliner','espionage'],
'six8':['desert-mastery','military-support','battle-hardened','controlled-tech','carthag','vast-wealth','swordmaster-6','economic-support','expedition','habbanya-erg']}
for k,l in names.items():
    for i,n in enumerate(l):
        a=f'cells/{k}-{i:02d}.jpg'; b=f'cells/{n}.jpg'
        os.replace(OUT+a,OUT+b); sizes[b]=sizes.pop(a)
crop('hagga-basin','ref',2,(28,38,172,102),sub='cells/')
crop('high-council','ref',1,(28,742,272,824),sub='cells/')
crop('deep-desert','ref',1,(514,373,656,435),sub='cells/')
json.dump(sizes,open(OUT+'_sizes.json','w'),indent=0)
for k,v in sorted(sizes.items()): print(k,v[0],v[1])
