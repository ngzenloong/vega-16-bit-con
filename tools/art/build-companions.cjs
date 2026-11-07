// Original native-grid companions. Only these pet SVGs and audit artifacts are written.
// The daisy head uses the supplied logo's actual six-petal silhouette.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/assets/vega');
const NOTES = path.join(ROOT, 'tools/art/metadata');
const C = {
  ink:'#0F3301', leaf:'#0D5500', leafLight:'#49832C', paper:'#FFFAEB',
  paperShade:'#DAD8B8', yellow:'#FFD11B', goldShade:'#B98B18',
  lime:'#D5FB19', orange:'#FF9823', orangeShade:'#B87421',
};

class Pixels {
  constructor() { this.rows=Array.from({length:24},()=>Array(24).fill(null)); }
  dot(x,y,c) { if(x>=0&&x<24&&y>=0&&y<24)this.rows[y][x]=c; }
  rect(x,y,w,h,c) { for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.dot(xx,yy,c); }
  line(a,b,c=C.ink) {
    let [x,y]=a;const [x1,y1]=b,dx=Math.abs(x1-x),sx=x<x1?1:-1,dy=-Math.abs(y1-y),sy=y<y1?1:-1;let e=dx+dy;
    for(;;){this.dot(x,y,c);if(x===x1&&y===y1)break;let e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}
  }
  poly(points,c,outline=C.ink) {
    for(let y=Math.min(...points.map(p=>p[1]));y<=Math.max(...points.map(p=>p[1]));y++){
      const xs=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],yy=y+.5;
        if((a[1]<=yy&&yy<b[1])||(b[1]<=yy&&yy<a[1]))xs.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);
      for(let i=0;i<xs.length;i+=2)for(let x=Math.ceil(xs[i]-.5);x<Math.ceil(xs[i+1]-.5);x++)this.dot(x,y,c);
    }
    if(outline)for(let i=0;i<points.length;i++)this.line(points[i],points[(i+1)%points.length],outline);
  }
  bounds() {
    const pts=[];for(let y=0;y<24;y++)for(let x=0;x<24;x++)if(this.rows[y][x])pts.push([x,y]);
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    return [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1];
  }
  runs() {
    let active=new Map(),done=[];
    for(let y=0;y<=24;y++){
      let next=new Map(),row=this.rows[y]||Array(24).fill(null),x=0;
      while(x<24){let col=row[x];if(!col){x++;continue;}let start=x;while(x<24&&row[x]===col)x++;
        let k=`${start}/${x-start}/${col}`,r=active.get(k)||[start,y,x-start,0,col];r[3]++;next.set(k,r);}
      for(const[k,r]of active)if(!next.has(k))done.push(r);active=next;
    }
    return done;
  }
}

function eyes(p,frame,y,left=10,right=14) {
  if(frame===2){p.rect(left-1,y,2,1,C.ink);p.rect(right,y,2,1,C.ink);}
  else {p.rect(left,y-1,1,2,C.ink);p.rect(right,y-1,1,2,C.ink);}
}

function cat(frame) {
  const p=new Pixels();
  // A high curled tail, pointed ears and two front paws give a feline silhouette.
  p.poly([[7,20],[4,18],[3,14],[3,10],[4,8],[6,9],[5,12],[6,16],[9,18]],C.orangeShade);
  p.line([4,10],[4,14],C.orange);
  if(frame===1||frame===3)p.dot(5,10,C.orange);
  p.poly([[9,12],[15,12],[17,16],[17,21],[14,22],[9,22],[7,20],[7,17]],C.orange);
  p.rect(9,16,5,5,C.paper);p.rect(9,20,5,1,C.paperShade);
  p.rect(15,17,2,1,C.orangeShade);p.rect(15,19,2,1,C.orangeShade);
  p.poly([[7,8],[7,3],[8,2],[11,6],[14,6],[17,2],[18,3],[18,11],[17,14],[8,14],[6,12],[6,9]],C.orange);
  p.rect(8,5,1,2,C.paperShade);p.rect(16,5,1,2,C.paperShade);
  p.rect(8,8,2,1,C.orangeShade);p.rect(15,8,2,1,C.orangeShade);
  p.rect(11,6,2,2,C.orangeShade);p.dot(10,7,C.orangeShade);p.dot(14,7,C.orangeShade);
  p.poly([[9,11],[15,11],[16,12],[14,14],[10,14],[8,12]],C.paper,null);
  eyes(p,frame,10);
  p.dot(12,11,C.ink);p.line([12,12],[11,13],C.orangeShade);p.dot(13,13,C.orangeShade);
  p.line([4,12],[7,12]);p.line([17,12],[20,12]);
  p.poly([[8,14],[16,14],[14,17],[11,16]],C.leaf);
  p.dot(14,15,C.lime);
  p.rect(8+(frame===1?1:0),21,3,2,C.ink);p.rect(9+(frame===1?1:0),21,2,1,C.paper);
  p.rect(14-(frame===3?1:0),21,3,2,C.ink);p.rect(14-(frame===3?1:0),21,2,1,C.paper);
  return p;
}

async function daisyMask() {
  const logo=fs.readFileSync(path.join(OUT,'logo.svg'),'utf8');
  const d=logo.match(/<path id="Subtract" d="([^"]+)"/)[1];
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="347 0 140 128"><path d="${d}" fill="white" fill-rule="evenodd"/></svg>`);
  const {data}=await sharp(svg).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=Array.from({length:17},(_,y)=>Array.from({length:18},(_,x)=>data[(y*18+x)*4+3]>=128));
  const outside=new Set(),queue=[];
  for(let y=0;y<17;y++)for(let x=0;x<18;x++)if(!mask[y][x]&&(x===0||x===17||y===0||y===16)){outside.add(`${x},${y}`);queue.push([x,y]);}
  while(queue.length){let[x,y]=queue.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(nx>=0&&nx<18&&ny>=0&&ny<17&&!mask[ny][nx]&&!outside.has(k)){outside.add(k);queue.push([nx,ny]);}}}
  const hole=[];for(let y=0;y<17;y++)for(let x=0;x<18;x++)if(!mask[y][x]&&!outside.has(`${x},${y}`))hole.push([x,y]);
  assert(hole.length>10,'Logo negative-space center must survive native sampling');
  return {mask,hole,sourceHash:crypto.createHash('sha256').update(d).digest('hex')};
}

function daisy(frame,source) {
  const p=new Pixels();
  // A little stem and fluttering leaves sit under the source-derived flower head.
  p.rect(11,16,2,6,C.ink);p.rect(12,17,1,4,C.leafLight);
  const lift=frame===1||frame===3?1:0;
  p.poly([[11,19],[8,17-lift],[6,18-lift],[8,21],[11,21]],C.leaf);
  p.poly([[13,19],[16,17+lift],[18,18+lift],[16,21],[13,21]],C.leafLight);
  p.dot(11,22,C.yellow);p.dot(13,22,C.yellow);
  const ox=3,oy=2;
  for(let y=0;y<17;y++)for(let x=0;x<18;x++)if(source.mask[y][x])for(const[dx,dy]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]])p.dot(ox+x+dx,oy+y+dy,C.ink);
  for(let y=0;y<17;y++)for(let x=0;x<18;x++)if(source.mask[y][x])p.dot(ox+x,oy+y,C.paper);
  for(const[x,y]of source.hole)p.dot(ox+x,oy+y,C.yellow);
  eyes(p,frame,10,10,14);
  p.dot(12,12,C.goldShade);
  // A one-pixel petal glint changes while the actual daisy silhouette stays fixed.
  p.dot(frame===1?7:17,frame===1?5:15,frame===2?C.paperShade:C.paper);
  return p;
}

function bot(frame) {
  const p=new Pixels();
  p.line([12,2],[12,6]);
  const tilt=frame===1?1:frame===3?-1:0;
  p.poly([[12,4],[9+tilt,3],[9+tilt,1],[12+tilt,2]],C.leaf);
  p.poly([[12,4],[14+tilt,1],[16+tilt,2],[14,4]],C.leafLight);
  p.poly([[6,7],[7,6],[17,6],[18,7],[18,13],[17,14],[7,14],[6,13]],C.paper);
  p.rect(7,12,10,1,C.paperShade);
  p.rect(8,8,9,4,C.leaf);
  if(frame===2){p.rect(9,10,2,1,C.paper);p.rect(14,10,2,1,C.paper);}
  else{p.rect(10,9,1,2,C.paper);p.rect(14,9,1,2,C.paper);}
  p.dot(12,11,C.yellow);
  p.rect(5,9,1,3,C.leafLight);p.rect(19,9,1,3,C.leafLight);
  p.poly([[9,14],[15,14],[17,16],[16,20],[8,20],[7,16]],C.leaf);
  p.rect(9,15,6,4,C.paper);
  p.rect(11,16,3,2,C.yellow);p.dot(12,17,C.goldShade);
  p.line([7,15],[5,17]);p.line([17,15],[19,17]);
  p.rect(4,17+(frame===3?1:0),3,2,C.ink);p.dot(5,17+(frame===3?1:0),C.paper);
  p.rect(18,17+(frame===1?1:0),3,2,C.ink);p.dot(19,17+(frame===1?1:0),C.paper);
  p.rect(8,20,2,2,C.ink);p.rect(14,20,2,2,C.ink);
  p.rect(7+(frame===1?1:0),22,4,1,C.ink);p.rect(13+(frame===3?1:0),22,4,1,C.ink);
  return p;
}

function firefly(frame) {
  const p=new Pixels();
  // Crisp folded-paper wings: broad, raised, folded and lowered poses.
  const wings=[
    [[[10,10],[5,5],[2,7],[4,13],[9,15]],[[14,10],[19,5],[22,7],[20,13],[15,15]]],
    [[[10,10],[7,3],[4,4],[5,10],[9,14]],[[14,10],[17,3],[20,4],[19,10],[15,14]]],
    [[[10,10],[6,8],[5,11],[8,15],[10,15]],[[14,10],[18,8],[19,11],[16,15],[14,15]]],
    [[[10,10],[5,9],[2,12],[6,16],[10,15]],[[14,10],[19,9],[22,12],[18,16],[14,15]]],
  ][frame];
  for(const pts of wings)p.poly(pts,C.paper);
  p.line(wings[0][1],[9,13],C.paperShade);p.line(wings[1][1],[15,13],C.paperShade);
  p.line([10,7],[9,4]);p.line([14,7],[15,4]);
  p.dot(9,3,C.yellow);p.dot(15,3,C.yellow);
  p.poly([[10,7],[14,7],[15,8],[15,11],[14,12],[10,12],[9,11],[9,8]],C.orange);
  p.dot(10,9,C.ink);p.dot(14,9,C.ink);
  p.dot(12,11,C.goldShade);
  p.poly([[10,12],[14,12],[16,14],[16,17],[14,20],[10,20],[8,17],[8,14]],C.yellow);
  p.rect(9,14,6,1,C.goldShade);
  p.rect(10,16,5,2,frame===1||frame===3?C.lime:C.paper);
  p.rect(11,18,3,1,C.yellow);
  p.dot(12,21,C.goldShade);p.dot(12,22,C.yellow);
  return p;
}

const escapeXml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

async function main() {
  // Capture current car files for this invocation so later authorized car edits
  // do not invalidate an old temporary checksum baseline.
  const carHashes=Object.fromEntries(fs.readdirSync(OUT).filter(n=>/^(car-|fiat-).*\.svg$/.test(n)).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT,n))).digest('hex')]));
  fs.mkdirSync(NOTES,{recursive:true});
  const source=await daisyMask();
  const specs=[
    {id:'cat',name:'Cat',draw:cat,fps:6,states:['alert','left step','blink','right step'],motion:'Tiny paw cycle and one blink; curled tail and head remain centered.',coreSample:[12,11,C.ink]},
    {id:'daisy',name:'Daisy fairy',draw:f=>daisy(f,source),fps:4,states:['leaves down','leaves flutter','blink','leaves settle'],motion:'Floating flower fairy with fluttering leaves; the actual six-petal logo silhouette remains fixed.',coreSample:[12,11,C.yellow]},
    {id:'bot',name:'Leaf bot',draw:bot,fps:6,states:['ready','antenna right','blink','antenna left'],motion:'Leaf antenna, tiny feet and claws animate around a fixed head/body.',coreSample:[12,17,C.goldShade]},
    {id:'firefly',name:'Paper-wing firefly',draw:firefly,fps:8,states:['wings open','wings raised','wings folded','wings lowered'],motion:'Paper wings flutter around a fixed gold spirit; no body translation or glow filters.',coreSample:[12,13,C.yellow]},
  ];
  const records=[];const contacts=[];
  for(let index=0;index<specs.length;index++){
    const s=specs[index],frames=Array.from({length:4},(_,i)=>s.draw(i));
    assert.equal(new Set(frames.map(p=>JSON.stringify(p.rows))).size,4,`${s.id}: all four states should differ`);
    const [cx,cy,col]=s.coreSample;
    for(const p of frames){assert.equal(p.rows[cy][cx],col,`${s.id}: stationary core sample`);for(let i=0;i<24;i++){assert.equal(p.rows[0][i],null);assert.equal(p.rows[23][i],null);assert.equal(p.rows[i][0],null);assert.equal(p.rows[i][23],null);}}
    const metadata={id:s.id,name:s.name,src:`/assets/vega/pet-${s.id}.svg`,width:24,height:24,sheetWidth:96,sheetHeight:24,frames:4,fps:s.fps,groundAnchor:[12,22],centerX:12,idleFrame:0,reducedMotionFrame:0,locomotion:['daisy','firefly'].includes(s.id)?'hover':'walk',frameStates:s.states,frameBounds:frames.map(p=>p.bounds()),motion:s.motion,coreSample:s.coreSample,rendering:'Native integer pixels. Render the 24x24 frame at 48x48 CSS pixels for the inspected 2x size. Frame offsets: 0,24,48,72. No external resources or fonts.',source:s.id==='daisy'?{path:'public/assets/vega/logo.svg',elementId:'Subtract',pathSha256:source.sourceHash,nativeSampling:[18,17],note:'Actual supplied six-petal silhouette, sampled to native pixels; original face, stem, leaves and animation.'}:{note:'Original code-native pixel drawing, informed by the established Vega dog/Sam outline and shading craft.'}};
    const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="24" viewBox="0 0 96 24" shape-rendering="crispEdges" role="img" aria-label="${s.name} pixel companion, four animation frames" data-frame-width="24" data-frame-height="24" data-frame-count="4">`,`  <title>${s.name} companion sprite sheet</title>`,`  <metadata>${escapeXml(JSON.stringify(metadata))}</metadata>`];
    frames.forEach((p,i)=>{svg.push(`  <g id="frame-${i}" data-frame="${i}" transform="translate(${i*24} 0)">`);for(const[x,y,w,h,c]of p.runs())svg.push(`    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);svg.push('  </g>');});svg.push('</svg>');
    const file=path.join(OUT,`pet-${s.id}.svg`);fs.writeFileSync(file,svg.join('\n')+'\n');
    const buffer=Buffer.from(svg.join('\n'));
    const native=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(native.info.width,96);assert.equal(native.info.height,24);
    for(let p=0;p<native.data.length;p+=4){const[r,g,b,a]=native.data.subarray(p,p+4);assert(a===0||a===255);if(a)assert(!(b>r+10&&b>g+10),`${s.id}: blue forbidden`);}
    const direct=await sharp(buffer,{density:144}).ensureAlpha().raw().toBuffer();
    const scaled=await sharp(native.data,{raw:native.info}).resize(192,48,{kernel:'nearest'}).raw().toBuffer();assert(direct.equals(scaled),`${s.id}: native grid render`);
    const y=index*144;
    const label=Buffer.from(`<svg width="780" height="28"><text x="16" y="20" font-family="monospace" font-size="16" fill="${C.ink}">${s.name} / ${s.fps} fps</text><text x="480" y="20" font-family="monospace" font-size="14" fill="${C.ink}">48 CSS px per frame</text></svg>`);
    contacts.push({input:label,left:0,top:y},{input:await sharp(buffer).resize(384,96,{kernel:'nearest'}).png().toBuffer(),left:16,top:y+34},{input:await sharp(buffer).resize(192,48,{kernel:'nearest'}).png().toBuffer(),left:480,top:y+58});
    records.push(metadata);
  }
  const contactPath=path.join(NOTES,'companions-contact.png');
  await sharp({create:{width:780,height:576,channels:4,background:C.paper}}).composite(contacts).png().toFile(contactPath);
  fs.writeFileSync(path.join(NOTES,'companion-metadata.json'),JSON.stringify(records,null,2)+'\n');
  for(const[name,hash]of Object.entries(carHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT,name))).digest('hex'),hash,`${name}: car assets must remain unchanged`);
  console.log(JSON.stringify({created:records.map(r=>({src:r.src,fps:r.fps,bounds:r.frameBounds})),contact:contactPath,checks:'16 distinct states; fixed core anchors; one-pixel frame guards; binary alpha; no blue; direct 2x/native-nearest equality; all 12 rival checksums unchanged'},null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
