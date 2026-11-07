// Local asset validation and reproducible contact sheets; no browser or runtime edits.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'tools/art/metadata/rival-car-metadata.json')));
const font = { S: ['111','100','111','001','111'], I: ['111','010','010','010','111'], E: ['111','100','110','100','111'], M: ['10001','11011','10101','10001','10001'] };
const white = [255,250,235];
const tea = ['00010001000','01111111110','00010001000','00000100000','00011011000','01100100110','00000100000','00111111100','00010101000','00100100100','01001100010'];

function label(text, width = 240) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="30"><text x="12" y="20" fill="#0F3301" font-family="monospace" font-size="14">${text}</text></svg>`);
}

(async () => {
  assert.equal(data.length, 12);
  assert(!data.some(m => m.id === 'a2'));
  const silhouettes = new Set();
  const contact = [], poses = [], small = [];
  let bytes = 0;
  for (let i = 0; i < data.length; i++) {
    const m = data[i], file = path.join(root, 'public/assets/vega', m.file);
    const svg = fs.readFileSync(file);
    bytes += svg.byteLength;
    assert(!/<(?:text|image|filter|script|foreignObject|linearGradient|radialGradient)\b/.test(svg.toString()));
    assert(!/\b(?:href|opacity|font-family)=/.test(svg.toString()));
    assert(!/PostSIEM|Fiat/.test(svg.toString()));
    if(m.id==='scargo')assert(!/siem/i.test(svg.toString()),'S-Cargo has only its requested central plate');
    const raw = await sharp(svg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(raw.info.width, 288);
    assert.equal(raw.info.height, 96);
    for (let p = 0; p < raw.data.length; p += 4) {
      const [r,g,b,a] = raw.data.subarray(p, p+4);
      assert(a === 0 || a === 255, `${m.id}: partial alpha`);
      if (a && b > r + 10 && b > g + 10) assert.equal(m.id, 'scargo', 'Blue must remain the explicit S-Cargo exception');
    }
    // SVG direct 2x equals nearest-neighbor 2x from its native raster.
    const direct = await sharp(svg,{density:144}).ensureAlpha().raw().toBuffer();
    const nearest = await sharp(raw.data,{raw:raw.info}).resize(576,192,{kernel:'nearest'}).raw().toBuffer();
    assert(direct.equals(nearest), `${m.id}: non-integer or antialiased geometry`);
    for (let frame = 0; frame < 3; frame++) {
      const pix = await sharp(raw.data,{raw:raw.info}).extract({left:frame*96,top:0,width:96,height:96}).raw().toBuffer();
      const points = [];
      for (let y=0;y<96;y++) for (let x=0;x<96;x++) if(pix[(y*96+x)*4+3]) points.push([x,y]);
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1];
      assert.deepEqual(bounds,m.frameBounds[frame],`${m.id}: bounds mismatch`);
      assert.equal(Math.max(...ys),90,`${m.id}: ground anchor`);
      if (m.id === 'scargo') {
        assert.equal(m.rearLettering, '茶');
        const [lx,ly] = m.rearLabelBoxes[frame];
        for(let y=0;y<11;y++) for(let x=0;x<11;x++) {
          const offset=((ly+2+y)*96+lx+5+x)*4;
          assert.deepEqual([...pix.subarray(offset,offset+3)],tea[y][x]==='1'?white:[15,51,1],`S-Cargo frame ${frame}: plate glyph ${x},${y}`);
        }
        assert.equal(m.factionLettering, undefined);
      }
      if(m.id!=='scargo') {
        const labelBox = m.rearLabelBoxes[frame];
        let cursor = labelBox[0] + 2;
        const top = labelBox[1] + 2;
        for (const c of 'SIEM') {
          for (let y=0;y<5;y++) for(let x=0;x<font[c][0].length;x++) {
            const px=[...pix.subarray(((top+y)*96+cursor+x)*4,((top+y)*96+cursor+x)*4+3)];
            if(font[c][y][x]==='1') assert.deepEqual(px,white,`${m.id} frame ${frame}: reversed/missing SIEM pixel`);
          }
          cursor += font[c][0].length+1;
        }
      }
      if (frame===0) silhouettes.add(crypto.createHash('sha256').update(Buffer.from(points.flat())).digest('hex'));
    }
    const png=await sharp(svg).png().toBuffer();
    const straight=await sharp(png).extract({left:0,top:0,width:96,height:96}).resize(192,192,{kernel:'nearest'}).png().toBuffer();
    const x=(i%4)*240,y=Math.floor(i/4)*234;
    contact.push({input:label(m.model),left:x,top:y},{input:straight,left:x+24,top:y+30});
    const px=(i%2)*600,py=Math.floor(i/2)*222;
    poses.push({input:label(`${m.model} — STRAIGHT / LEFT / RIGHT`,600),left:px,top:py},
      {input:await sharp(png).resize(576,192,{kernel:'nearest'}).png().toBuffer(),left:px+12,top:py+26});
    const sx=(i%4)*180,sy=Math.floor(i/4)*130;
    small.push({input:label(m.id,180),left:sx,top:sy},
      {input:await sharp(png).extract({left:0,top:0,width:96,height:96}).resize(48,48,{kernel:'nearest'}).png().toBuffer(),left:sx+20,top:sy+46},
      {input:await sharp(png).extract({left:0,top:0,width:96,height:96}).png().toBuffer(),left:sx+78,top:sy+28});
  }
  assert.equal(silhouettes.size,12,'Every model must have its own silhouette, not a recolor');
  await sharp({create:{width:960,height:702,channels:4,background:'#FFFAEB'}}).composite(contact).png().toFile('/tmp/vega-rival-cars-contact.png');
  await sharp({create:{width:1200,height:1332,channels:4,background:'#FFFAEB'}}).composite(poses).png().toFile('/tmp/vega-rival-cars-poses.png');
  await sharp({create:{width:720,height:390,channels:4,background:'#FFFAEB'}}).composite(small).png().toFile('/tmp/vega-rival-cars-phone-scale.png');
  const snapshot='/tmp/vega-rival-original-fiat-hashes.json';
  if(fs.existsSync(snapshot)) for(const [filename,hash] of Object.entries(JSON.parse(fs.readFileSync(snapshot)))) {
    if(filename==='fiat-player.svg') {
      // User authorized new steering frames; preserve the exact original straight group.
      const canonicals=JSON.parse(fs.readFileSync(path.join(root,'tools/art/rear-canonicals.json')));
      const canonical=canonicals.find(c=>c.file===filename);
      const current=fs.readFileSync(path.join(root,'public/assets/vega',filename),'utf8').match(/  <g id="straight"[\s\S]*?<\/g>/)[0];
      assert.equal(current,canonical.straightGroup);
      continue;
    }
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/assets/vega',filename))).digest('hex'),hash,`Original ${filename} modified`);
  }
  console.log(JSON.stringify({models:data.length,frames:data.length*3,distinctSilhouettes:silhouettes.size,bytes,checks:'RGBA, integer 2x grid, forward bitmap SIEM, S-Cargo tea plate, bounds, shared anchor, external resources, blue exception, original Fiat checksums',contact:'/tmp/vega-rival-cars-contact.png',poses:'/tmp/vega-rival-cars-poses.png',phoneScale:'/tmp/vega-rival-cars-phone-scale.png'},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
