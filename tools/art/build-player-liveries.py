"""Make unlocked player liveries without modifying the rival originals."""
from pathlib import Path
import json
from copy import deepcopy
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'public/assets/vega'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
metadata = json.loads((Path(__file__).parent / 'metadata/car-turn-metadata.json').read_text())
# Reuse the official standalone daisy at the original faction-label bounds.
logo = ET.parse(ASSETS / 'logo.svg').getroot()
daisy = next(node for node in logo.iter() if node.attrib.get('id') == 'Subtract')
mark = ET.Element(f'{{{NS}}}svg', {'width': '7', 'height': '7', 'viewBox': '346 0 140 127'})
shape = deepcopy(daisy)
shape.set('fill', '#FFFFFF')
mark.append(shape)
# Sample the real signet once at native resolution, then emit integer rectangles.
raster = subprocess.run(['node', '-e', "const sharp=require('sharp');const fs=require('fs');sharp(fs.readFileSync(0)).ensureAlpha().raw().toBuffer().then(b=>console.log(JSON.stringify(Array.from({length:49},(_,i)=>b[i*4+3]>=128))))"], input=ET.tostring(mark), capture_output=True, check=True, cwd=ROOT)
pixels = json.loads(raster.stdout)
for car in metadata:
    if car['id'] in ('fiat-player', 'scargo'):
        continue
    source = ASSETS / car['file']
    tree = ET.parse(source)
    root = tree.getroot()
    root.set('aria-label', car['model'] + ' player livery rear-turn sprite sheet')
    for index, group in enumerate(root.findall(f'{{{NS}}}g')):
        x, y, w, h = car['rearLabelBoxes'][index]
        badge = ET.SubElement(group, f'{{{NS}}}g', {'data-player-badge': 'daisy'})
        ET.SubElement(badge, f'{{{NS}}}rect', {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'fill': '#0F3301'})
        for index, filled in enumerate(pixels):
            if filled:
                ET.SubElement(badge, f'{{{NS}}}rect', {'x': str(x + (w-7)//2 + index % 7), 'y': str(y + (h-7)//2 + index // 7), 'width': '1', 'height': '1', 'fill': '#FFD11B'})
    meta = root.find(f'{{{NS}}}metadata')
    if meta is not None:
        value = json.loads(meta.text)
        value['rearLettering'] = 'Daisy badge'
        meta.text = json.dumps(value, separators=(',', ':'))
    tree.write(ASSETS / source.name.replace('.svg', '-player.svg'), encoding='unicode')
print('Built 10 player liveries; Fiat campaign art and S-Cargo tea plate preserved.')
