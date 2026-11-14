#!/usr/bin/env python3
"""Original Puerto Rico badge geometry. Python + CairoSVG 2.8.2 + Pillow 11.3.0."""
from pathlib import Path
import hashlib, json, math
import cairosvg
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/achievements'
OUT.mkdir(parents=True, exist_ok=True)
INK='#49372d'; CREAM='#fff0ce'; GOLD='#efb642'; RED='#c65d3e'; GREEN='#547548'; SEA='#336e73'
def path(d, fill='none', stroke=INK, sw=5):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
def rect(x,y,w,h,fill=CREAM,r=5):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{INK}" stroke-width="4"/>'
def circle(x,y,r,fill=GOLD):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="4"/>'
def text(s,x,y,size=36,fill=INK):
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="{size}" fill="{fill}">{s}</text>'
def group(s,x=0,y=0,scale=1,rotate=0):
    return f'<g transform="translate({x} {y}) scale({scale}) rotate({rotate})">{s}</g>'
def check(x,y,scale=1):
    return group(path('M-13 0 -3 11 18 -15','none',GREEN,8),x,y,scale)
def flag(x,y):
    return group(path('M0 38 V-20',stroke=INK)+path('M0 -20 H45 L32 -3 45 12 H0',GOLD),x,y)
def house(x,y,w=28,h=27):
    return rect(x,y,w,h,CREAM,2)+path(f'M{x-3} {y} L{x+w/2} {y-14} {x+w+3} {y} Z',RED)+path(f'M{x+w/2} {y+h} v-12',stroke=SEA,sw=6)
def person(x,y):
    return circle(x,y-15,10,CREAM)+path(f'M{x-17} {y+20} Q{x-17} {y} {x} {y} Q{x+17} {y} {x+17} {y+20} Z',SEA)
def crop(kind):
    if kind=='corn': return path('M0 18 Q-22 0 -4 -20 Q17 -24 12 0 Z',GOLD)+path('M0 18 Q-22 15 -19 -4 M0 18 Q22 6 20 -7',stroke=GREEN)
    if kind=='fruit': return circle(-7,5,11,RED)+circle(10,5,11,GOLD)+path('M0 -4 Q-10 -23 10 -20 Q15 -6 0 -4',GREEN)
    if kind=='sugar': return path('M-9 20 L-3 -20 M7 20 L13 -20',stroke=GREEN,sw=8)+path('M-11 5 H16 M-8 -8 H18',stroke=CREAM,sw=3)
    if kind=='tobacco': return path('M-15 18 Q-25 -17 17 -23 Q25 10 -15 18',GREEN)+path('M-15 18 L12 -15',stroke=CREAM,sw=3)
    return path('M-13 18 C-33 -4 -2 -30 12 -16 C31 3 5 30 -13 18', '#85503c')+path('M-7 16 Q-17 0 7 -14',stroke=CREAM,sw=4)
def ledger(x=69,y=62,w=118,h=121):
    return rect(x,y,w,h)+path(f'M{x+18} {y+23} H{x+w-18} M{x+18} {y+45} H{x+w-18}',stroke=RED,sw=5)
def star(x,y,r=24):
    pts=[]
    for i in range(10):
        a=-math.pi/2+i*math.pi/5; rr=r if i%2==0 else r*.47
        pts.append(f'{x+math.cos(a)*rr:.2f} {y+math.sin(a)*rr:.2f}')
    return path('M'+' L'.join(pts)+' Z',GOLD)
art={}
art['island-victory']=path('M43 166 Q53 113 101 111 Q129 85 167 118 Q210 125 210 163 Q173 196 71 184 Z',GREEN)+path('M44 194 Q74 183 100 196 T155 196 T211 196',stroke=SEA,sw=9)+house(75,128,37,34)+house(128,120,40,42)+flag(129,69)+path('M169 174 h39 l-9 13 h-23 Z',RED)+path('M184 174 v-30 l22 24 h-22',CREAM)
fan=rect(-22,-30,43,66,SEA)+group(rect(-22,-30,43,66,CREAM),-11,-2,1,-16)+path('M-12 -10 H10 M-12 3 H10 M-12 16 H2',stroke=RED,sw=5)
art['puertoma-normal']=group(fan,66,148,.95,-12)+group(fan,190,148,.95,12)+person(128,115)+flag(128,55)+path('M94 151 L112 157 M144 157 L162 151',stroke=GOLD,sw=7)
# A closed all-set ledger / continuous fan edge denotes variable active set, not a fixed deck size.
art['all-festival-objectives']=path('M55 78 Q128 23 201 78 M55 78 L62 101 78 69 M178 69 L194 101 201 78',stroke=RED,sw=7)+ledger(65,89,126,103)+text('ALL',128,131,30)+check(128,165)+path('M49 118 V195 H207 V118',stroke=GREEN,sw=7)
art['all-personal-achievements']=path('M65 187 L43 93 164 57 192 158 Z',SEA)+path('M72 193 L58 76 181 61 196 181 Z',RED)+rect(78,77,115,123)+text('ALL',135,125,31)+circle(136,162,24,GOLD)+check(136,163,.85)
art['festival-claim']=rect(55,66,135,131)+path('M64 81 H180 L164 112 180 142 H64 Z',RED)+circle(111,120,20,GOLD)+path('M191 183 L154 157 123 146 Q113 141 116 134 Q119 127 130 131 L145 135 128 115 Q121 105 131 101 Q135 100 142 106 L179 135 203 151 Z',CREAM)
art['personal-achievement']=rect(77,50,105,151)+path('M97 78 H163 M97 94 H152',stroke=RED)+group(crop('tobacco'),127,125,.85)+circle(156,179,27,GOLD)+check(156,180,.95)
art['fifty-points']=ledger(88,60,104,132)+text('50',140,158,43)+star(65,143,27)+star(69,188,22)
art['seventy-points']=path('M56 190 V69 L123 53 200 69 V190 L126 178 Z',CREAM)+path('M126 59 V128',stroke=RED)+text('70',128,123,43)+star(78,180,23)+star(128,166,26)+star(178,150,23)
art['full-city']=rect(54,59,148,142,SEA,9)+''.join(house(66+c*33,80+r*39,25,24) for r in range(3) for c in range(4))
art['full-island']=path('M44 83 Q71 40 171 51 Q215 61 217 150 Q211 198 163 208 L78 201 Q37 181 44 83 Z',GREEN)
for r in range(3):
    for c in range(4):
        x=62+c*34; y=66+r*43
        art['full-island']+=rect(x,y,29,37,'#d2b77c',3)
        art['full-island']+= group(crop(['corn','fruit','sugar','tobacco','coffee'][(r*4+c)%5]),x+14,y+18,.52) if (r,c)!=(2,3) else path(f'M{x+4} {y+29} l5 -17 12 -4 5 21 Z','#a6a6a0')
art['expanded-city']=rect(55,66,147,126,SEA)+house(68,88,120,33)+house(68,148,120,33)+path('M128 91 V116 M128 151 V176',stroke=RED,sw=3)+path('M72 127 H185 M72 187 H185',stroke=GOLD,sw=5)
art['five-crop-estates']=''
for i,kind in enumerate(['corn','fruit','sugar','tobacco','coffee']):
    a=(-90+i*72)*math.pi/180; x=128+63*math.cos(a); y=130+63*math.sin(a)
    art['five-crop-estates']+=group(rect(-25,-31,50,62,'#d2b77c')+crop(kind),x,y)
art['twenty-coins']=path('M62 119 V74 Q128 35 194 74 V119 Z',RED)+path('M69 109 V82 Q128 56 187 82 V109',CREAM)+rect(56,123,145,69,RED)+''.join(circle(x,y,18,GOLD) for x,y in [(83,121),(111,109),(142,117),(174,114)])+rect(75,151,107,45,CREAM)+text('20',128,187,37)
roles=[crop('corn'), person(0,0),path('M-18 17 L13 -14 M-2 -20 L22 4',stroke=RED,sw=10),rect(-18,-14,36,32,RED)+path('M-18 -3 H18 M0 -14 V18',stroke=CREAM,sw=4),path('M-21 -7 H15 L7 -15 M21 10 H-15 L-7 18',stroke=GOLD,sw=6),path('M0 -22 V16 M-20 2 Q-20 22 0 22 Q20 22 20 2 M-10 -10 H10',stroke=SEA,sw=6)]
art['six-core-roles']=f'<circle cx="128" cy="128" r="69" fill="none" stroke="{RED}" stroke-width="7"/>'+circle(128,128,20,GOLD)
for i,s in enumerate(roles):
    a=(-90+i*60)*math.pi/180; x=128+70*math.cos(a); y=128+70*math.sin(a)
    art['six-core-roles']+=circle(x,y,28,CREAM)+group(s,x,y,.73)
manifest=[]
for id,body in art.items():
    key='achievement-'+id
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><title>{id}</title><circle cx="128" cy="128" r="122" fill="#f4dca5" stroke="{INK}" stroke-width="7"/>{body}</svg>'
    (OUT/(key+'.svg')).write_text(svg+'\n')
    cairosvg.svg2png(bytestring=svg.encode(),write_to=str(OUT/(key+'.png')),output_width=256,output_height=256)
    manifest.append(dict(id=id,key=key,svg=key+'.svg',png=key+'.png',svgSha256=hashlib.sha256((svg+'\n').encode()).hexdigest(),pngSha256=hashlib.sha256((OUT/(key+'.png')).read_bytes()).hexdigest(),width=256,height=256,provenance='Original geometry in scripts/achievement-art.py; CC0-1.0'))
(OUT/'manifest.json').write_text(json.dumps(dict(game='puerto-rico',revision=2,engineVersion='0.3.20',generatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),assets=manifest),indent=2)+'\n')
for dark in [False,True]:
    bg='#182c30' if dark else '#fffaf0'; fg='#fff0ce' if dark else INK
    sheet=Image.new('RGB',(1080,4*245),bg); draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(manifest):
        x=(i%4)*270;y=(i//4)*245
        im=Image.open(OUT/row['png']).convert('RGBA')
        sheet.paste(im.resize((144,144),Image.Resampling.LANCZOS),(x+63,y+6),im.resize((144,144),Image.Resampling.LANCZOS))
        for size,dx in [(32,35),(48,93),(64,170)]:
            small=im.resize((size,size),Image.Resampling.LANCZOS)
            mask=Image.new('L',(size,size)); ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
            sheet.paste(small,(x+dx,y+154),mask)
        draw.text((x+7,y+226),row['id'],fill=fg)
    sheet.save(OUT/('contact-dark.png' if dark else 'contact-light.png'))
print(f'Generated {len(manifest)} original badges and circular 32/48/64px contact sheets')
