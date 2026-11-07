// Stronger rear turns built from preserved rear pixels and complete model profiles.
// --preview renders contacts without writing the public sheets or handoff metadata.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sharp=require('sharp');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'public/assets/vega'),NOTES=path.join(ROOT,'tools/art/metadata');
const PREVIEW=process.argv.includes('--preview');
const canonicals=JSON.parse(fs.readFileSync(path.join(__dirname,'rear-canonicals.json')));
const profiles=JSON.parse(fs.readFileSync(path.join(NOTES,'car-profile-metadata.json')));
const INK='#0F3301',WHITE='#FFFAEB',GLASS=new Set(['#293F31','#59705B','#8A9C7D']);
const configurations={
  'fiat-player':{roofY:22,exposure:16,depthY:11,roof:'#D8DC20',roofLight:'#EEF044',outline:'#252C20',handles:[[61,61]],depth:y=>y<48?Math.max(0,(48-y)/13):0,extraLabel:[34,54,30,13]},
  mini:{roofY:28,exposure:15,depthY:11,roof:'#FFFAEB',roofLight:'#DFDEC4',handles:[[55,64]],depth:y=>y<50?Math.max(0,(50-y)/9):0},
  az1:{roofY:43,exposure:16,depthY:10,roof:'#FF9823',roofLight:'#FFE577',handles:[[63,68]],depth:y=>y<63?Math.min(4,(63-y)/3):0},
  isetta:{roofY:27,exposure:12,depthY:9,roof:'#FFD11B',roofLight:'#FFE577',handles:[[33,63]],depth:y=>y<45?1:0,centerRearWheel:true},
  p50:{roofY:31,exposure:10,depthY:8,roof:'#FFFAEB',roofLight:'#DFDEC4',handles:[[46,66]],centerRearWheel:true},
  'sambar-van':{roofY:20,exposure:16,depthY:12,roof:'#D5FB19',roofLight:'#FFE577',handles:[[27,59],[57,59]]},
  'sambar-truck':{roofY:24,exposure:16,depthY:12,roof:'#FFFAEB',roofLight:'#DFDEC4',handles:[[33,62]],depth:y=>y<47?11:y<64?11*(64-y)/17:0},
  midget:{roofY:26,exposure:13,depthY:11,roof:'#FF9823',roofLight:'#FFE577',handles:[[40,64]],depth:y=>y<45?10:y<65?10*(65-y)/20:0},
  smart:{roofY:29,exposure:13,depthY:11,roof:'#DFDEC4',roofLight:'#FFFAEB',handles:[[57,64]],depth:y=>y<58?1:0},
  be1:{roofY:33,exposure:15,depthY:11,roof:'#FFD11B',roofLight:'#FFE577',handles:[[62,64]],depth:y=>y<55?1:0},
  pao:{roofY:28,exposure:15,depthY:11,roof:'#DFDEC4',roofLight:'#FFFAEB',handles:[[61,64]],canvasRoof:true},
  figaro:{roofY:34,exposure:16,depthY:10,roof:'#FFFAEB',roofLight:'#DFDEC4',handles:[[60,64]],depth:y=>y<49?4:y<59?4*(59-y)/10:0},
  scargo:{roofY:20,exposure:16,depthY:11,roof:'#2D4560',roofLight:'#435E78',handles:[[57,61]],rearStrips:true},
};

class Pixels{
  constructor(){this.rows=Array.from({length:96},()=>Array(96).fill(null));}
  dot(x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&x<96&&y>=0&&y<96)this.rows[y][x]=c;else if(c)throw Error(`Clipped pixel ${x},${y}`);}
  rect(x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.dot(xx,yy,c);}
  ellipse(cx,cy,rx,ry,c,upperOnly=false){cx=Math.round(cx);cy=Math.round(cy);for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++)if((!upperOnly||y<=cy+1)&&((x-cx)/rx)**2+((y-cy)/ry)**2<=1.03)this.dot(x,y,c);}
  line(a,b,c=INK,clip=false){let[x,y]=a.map(Math.round);const[tx,ty]=b.map(Math.round),dx=Math.abs(tx-x),sx=x<tx?1:-1,dy=-Math.abs(ty-y),sy=y<ty?1:-1;let e=dx+dy;for(;;){if(!clip||this.rows[y]?.[x])this.dot(x,y,c);if(x===tx&&y===ty)break;let q=2*e;if(q>=dy){e+=dy;x+=sx;}if(q<=dx){e+=dx;y+=sy;}}}
  poly(ps,c,outline=INK){ps=ps.map(p=>p.map(Math.round));for(let y=Math.min(...ps.map(p=>p[1]));y<=Math.max(...ps.map(p=>p[1]));y++){const xs=[];for(let i=0;i<ps.length;i++){let a=ps[i],b=ps[(i+1)%ps.length],yy=y+.5;if((a[1]<=yy&&yy<b[1])||(b[1]<=yy&&yy<a[1]))xs.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)for(let x=Math.ceil(xs[i]-.5);x<Math.ceil(xs[i+1]-.5);x++)this.dot(x,y,c);}if(outline)for(let i=0;i<ps.length;i++)this.line(ps[i],ps[(i+1)%ps.length],outline);}
  mirror(){const p=new Pixels();p.rows=this.rows.map(r=>[...r].reverse());return p;}
  paste(p){for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(p.rows[y][x])this.rows[y][x]=p.rows[y][x];}
  bounds(){const a=[];for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(this.rows[y][x])a.push([x,y]);let xs=a.map(p=>p[0]),ys=a.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1];}
  runs(){let active=new Map(),done=[];for(let y=0;y<=96;y++){const row=this.rows[y]||Array(96).fill(null),next=new Map();let x=0;while(x<96){const c=row[x];if(!c){x++;continue;}let a=x;while(x<96&&row[x]===c)x++;const k=`${a}/${x-a}/${c}`,r=active.get(k)||[a,y,x-a,0,c];r[3]++;next.set(k,r);}for(const[k,r]of active)if(!next.has(k))done.push(r);active=next;}return done;}
}
async function raster(svg,frame=0){const {data,info}=await sharp(svg).ensureAlpha().raw().toBuffer({resolveWithObject:true});const p=new Pixels();for(let y=0;y<96;y++)for(let x=0;x<96;x++){let i=(y*info.width+frame*96+x)*4;if(data[i+3]){assert.equal(data[i+3],255);p.rows[y][x]='#'+[...data.subarray(i,i+3)].map(v=>v.toString(16).padStart(2,'0').toUpperCase()).join('');}}return p;}
function groupSvg(group){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" shape-rendering="crispEdges">${group}</svg>`);}
function pixelSvg(p){return groupSvg(p.runs().map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join(''));}
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const rounded=p=>p.map(Math.round);
function mapBox(box,point){const[x,y,w,h]=box,pts=[[x,y],[x+w-1,y],[x+w-1,y+h-1],[x,y+h-1]].map(point);let xs=pts.map(p=>Math.round(p[0])),ys=pts.map(p=>Math.round(p[1]));return[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1];}

function makeTurn(id,canonical,side,profile,cfg){
  const scale=.86,center=54,depth=y=>cfg.depth?cfg.depth(y):0;
  const rearPoint=([x,y])=>[center+(x-48)*scale-depth(y),y];
  const edges=[];for(let y=0;y<96;y++){const row=canonical.rows[y],xs=[];for(let x=0;x<96;x++)if(row[x])xs.push(x);edges[y]=xs.length?Math.min(...xs):48;}
  function leftEdge(y){y=Math.min(90,Math.max(cfg.roofY,Math.round(y)));const a=[];for(let yy=Math.max(cfg.roofY,y-2);yy<=Math.min(90,y+2);yy++)a.push(edges[yy]);a.sort((a,b)=>a-b);return a[Math.floor(a.length/2)];}
  const [fx,,fw]=profile.frameBounds[0],end=fx+fw-1,sy=(90-cfg.roofY)/(90-profile.bodyTop);
  const canonicalTop=canonical.bounds()[1];
  const sidePoint=([x,y])=>{const t=Math.max(0,Math.min(1,(x-fx)/(end-fx))),baseY=90-(90-y)*sy;return[center+(leftEdge(baseY)-48)*scale-cfg.exposure*(1-t)+4*t,baseY-cfg.depthY*(1-t)];};
  const sideLayer=new Pixels(),bins=new Map(),glassBins=new Map();
  const rearWheel=profile.wheels[0].rear,radius=profile.wheels[0].radius;
  for(let y=profile.bodyTop;y<=90;y++)for(let x=fx;x<=end;x++){
    let color=side.rows[y][x];if(!color)continue;
    if(cfg.centerRearWheel&&y>=rearWheel[1]-radius&&(x-rearWheel[0])**2+(y-rearWheel[1])**2<=(radius+2)**2)continue;
    if(id==='fiat-player'&&x>=29&&x<78&&y>=66&&y<71)color='#D8DC20';
    if(id==='scargo'&&x>end-5&&y<76&&(color===WHITE||color==='#DFDEC4'))color='#4384D6';
    const [px,py]=sidePoint([x,y]);
    const xx=Math.round(px),y0=Math.floor(py-sy/2),y1=Math.ceil(py+sy/2);
    for(let yy=y0;yy<y1;yy++){
      if(xx<1||xx>94||yy<canonicalTop||yy>90)continue;
      const key=`${xx},${yy}`,counts=bins.get(key)||new Map();counts.set(color,(counts.get(color)||0)+1);bins.set(key,counts);
      if(GLASS.has(color)){const g=glassBins.get(key)||new Map();g.set(color,(g.get(color)||0)+1);glassBins.set(key,g);}
    }
  }
  const dominant=counts=>[...counts].sort((a,b)=>b[1]-a[1])[0][0];
  // Close subpixel gaps inside each projected body row before restoring details.
  // This gives the side a continuous painted surface rather than isolated strokes.
  const darkColors=new Set([INK,'#252C20','#182218','#293127','#41493C','#A5AC96',...GLASS]);
  const rowData=new Map();
  for(const[key,colors]of bins){const[x,y]=key.split(',').map(Number),r=rowData.get(y)||{xs:[],colors:new Map()};r.xs.push(x);for(const[c,n]of colors)if(!darkColors.has(c))r.colors.set(c,(r.colors.get(c)||0)+n);rowData.set(y,r);}
  for(const[y,r]of rowData){const base=r.colors.size?dominant(r.colors):'#293127';for(let x=Math.min(...r.xs);x<=Math.max(...r.xs);x++)sideLayer.dot(x,y,base);}
  for(const[key,colors]of bins){const[x,y]=key.split(',').map(Number);sideLayer.dot(x,y,dominant(colors));}
  // Preserve the actual model's glazing mask and pillars after foreshortening.
  for(const[key]of glassBins){const[x,y]=key.split(',').map(Number);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(!glassBins.has(`${x+dx},${y+dy}`)&&sideLayer.rows[y+dy]?.[x+dx])sideLayer.dot(x+dx,y+dy,cfg.outline||INK);}
  for(const[key,colors]of glassBins){const[x,y]=key.split(',').map(Number);sideLayer.dot(x,y,dominant(colors));}
  // Project the model-specific door boundaries, handles and bed rails as crisp details.
  const seam=id==='scargo'?'#2166C3':id==='fiat-player'?'#919B1B':'#41493C';
  for(const box of [profile.doorBoxes[0],...(profile.bedBoxes?[profile.bedBoxes[0]]:[])]){
    const[x,y,w,h]=box,points=[[x,y],[x+w-1,y],[x+w-1,y+h-1],[x,y+h-1]].map(sidePoint).map(rounded);
    for(let i=0;i<4;i++)sideLayer.line(points[i],points[(i+1)%4],seam,true);
  }
  for(const handle of cfg.handles){const[x,y]=rounded(sidePoint(handle));if(sideLayer.rows[y]?.[x]){sideLayer.dot(x,y,WHITE);if(sideLayer.rows[y+1]?.[x])sideLayer.dot(x,y+1,cfg.outline||INK);}}
  // Wheels need a readable ellipse at this angle; preserve the profile's actual
  // centers/arch placement while allocating a minimum native sidewall width.
  const projectedWheels=[];
  for(const which of ['front',...(cfg.centerRearWheel?[]:['rear'])]){
    const source=profile.wheels[0][which],centerPoint=rounded(sidePoint(source));
    const rx=Math.max(2,Math.round(radius*.45)),ry=Math.max(4,Math.round(radius*sy));
    const trim=side.rows[Math.max(profile.bodyTop,source[1]-radius-2)]?.[source[0]]||cfg.roof;
    sideLayer.ellipse(centerPoint[0],centerPoint[1],rx+1,ry+1,id==='scargo'?WHITE:trim,true);
    sideLayer.ellipse(centerPoint[0],centerPoint[1],rx,ry,'#182218');
    sideLayer.ellipse(centerPoint[0],centerPoint[1],Math.max(1,rx-1),Math.max(2,ry-3),'#A5AC96');
    sideLayer.ellipse(centerPoint[0],centerPoint[1],1,Math.max(1,ry-5),'#41493C');
    sideLayer.dot(centerPoint[0],centerPoint[1],WHITE);
    projectedWheels.push({which,center:centerPoint,radii:[rx,ry]});
  }
  const turn=new Pixels();turn.paste(sideLayer);
  const rearLayer=new Pixels(),top=canonical.bounds()[1];
  for(let y=top;y<=90;y++)for(let tx=1;tx<95;tx++){
    const roofDepth=y<cfg.roofY?Math.round(cfg.exposure*.58)*(cfg.roofY-y)/Math.max(1,cfg.roofY-top):0;
    const sx=Math.round((tx-center+depth(y)+roofDepth)/scale+48);if(sx>=0&&sx<96&&canonical.rows[y][sx])rearLayer.dot(tx,y,canonical.rows[y][sx]);
  }
  // Keep each car's stepped/rounded roof craft and its actual colors.
  turn.paste(rearLayer);
  const boundary=[];for(let y=1;y<95;y++)for(let x=1;x<95;x++)if(turn.rows[y][x]&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!turn.rows[y+dy][x+dx]))boundary.push([x,y]);
  for(const[x,y]of boundary)turn.dot(x,y,cfg.outline||INK);
  if(cfg.rearStrips){
    for(const ps of [ [[24,20],[26,20],[21,29],[19,48],[19,78],[17,78],[17,48],[20,28]], [[69,20],[71,20],[76,27],[79,47],[79,78],[76,78],[76,48],[73,28]] ])turn.poly(ps.map(rearPoint),WHITE,null);
    for(const ps of [[[19,35],[18,40],[18,50],[18,58],[18,64],[18,70],[18,78]],[[75,35],[76,40],[77,50],[77,58],[77,64],[77,70],[77,78]]])for(let i=0;i<ps.length-1;i++)turn.line(rearPoint(ps[i]),rearPoint(ps[i+1]),WHITE);
  }
  return{turn,rearPoint,sidePoint,sideLayer,rearLayer,scale,center,exposure:cfg.exposure,projectedWheels};
}

function pasteOriginalLabel(dest,canonical,sourceBox,targetBox){const[sx,sy,w,h]=sourceBox,[tx,ty]=targetBox;for(let y=0;y<h;y++)for(let x=0;x<w;x++)dest.dot(tx+x,ty+y,canonical.rows[sy+y][sx+x]);}
async function main(){
  const prepared=[];
  for(const c of canonicals){const id=c.file==='fiat-player.svg'?'fiat-player':c.file.slice(4,-4),p=profiles.find(p=>p.id===id);assert(p&&configurations[id],`Profile/config missing: ${id}`);assert(fs.existsSync(path.join(OUT,p.file)));const actual=fs.readFileSync(path.join(OUT,c.file),'utf8').match(/  <g id="straight"[\s\S]*?<\/g>/)[0];assert.equal(actual,c.straightGroup,`${id}: straight source changed`);prepared.push({c,id,profile:p,canonical:await raster(groupSvg(c.straightGroup)),side:await raster(fs.readFileSync(path.join(OUT,p.file)))});}
  const contacts=[],metadata=[],generated=[];
  for(let index=0;index<prepared.length;index++){
    const{c,id,profile,canonical,side}=prepared[index],cfg=configurations[id],result=makeTurn(id,canonical,side,profile,cfg);
    const left=result.turn,right=left.mirror(),frames=[canonical,left,right];
    const sourceLabel=c.originalMetadata.rearLabelBoxes[0],w=sourceLabel[2],h=sourceLabel[3];
    const center=result.rearPoint([sourceLabel[0]+w/2,sourceLabel[1]])[0],lx=Math.round(center-w/2);
    const boxes=[sourceLabel,[lx,sourceLabel[1],w,h],[96-lx-w,sourceLabel[1],w,h]];
    pasteOriginalLabel(left,canonical,sourceLabel,boxes[1]);pasteOriginalLabel(right,canonical,sourceLabel,boxes[2]);
    const extras=[];
    if(cfg.extraLabel){const b=cfg.extraLabel,cx=result.rearPoint([b[0]+b[2]/2,b[1]])[0],x=Math.round(cx-b[2]/2),ls=[x,b[1],b[2],b[3]],rs=[96-x-b[2],b[1],b[2],b[3]];pasteOriginalLabel(left,canonical,b,ls);pasteOriginalLabel(right,canonical,b,rs);extras.push(b,ls,rs);}
    const bounds=frames.map(p=>p.bounds());for(const b of bounds){assert(b[0]>0&&b[1]>0&&b[0]+b[2]<96&&b[1]+b[3]===bounds[0][1]+bounds[0][3],`${id}: clipped/ground-shifted turn ${JSON.stringify(b)}`);}
    const meta={...c.originalMetadata,frameBounds:bounds,rearLabelBoxes:boxes,groundAnchor:[48,90],turnAngleDegrees:30,sideExposureNative:cfg.exposure,turnSourceProfile:profile.file,projectedSideWheels:result.projectedWheels,straightGroupSha256:c.straightGroupSha256,turnConstruction:'Rear pixels remain a distinct face. Complete model-specific side profile, glazing, door boundaries, handles and bed details are projected into a stronger rear turn. Rear lettering is copied at native size after geometric mirroring.',maxVisibleWidth:Math.max(...bounds.map(b=>b[2]))};
    if(meta.bodyBounds){meta.straightBodyBounds=meta.bodyBounds[0];delete meta.bodyBounds;}
    delete meta.maxBodyWidth;
    meta.boundsNote='frameBounds/maxVisibleWidth include all opaque body and tire pixels. Where present, bodyWidth/straightBodyBounds retain the original straight-body collision reference; yaw bounds are conservative visible bounds.';
    if(extras.length)meta.numberPlateBoxes=extras;
    if(meta.rearWindowBoxes){let wb=mapBox(meta.rearWindowBoxes[0],result.rearPoint);meta.rearWindowBoxes=[meta.rearWindowBoxes[0],wb,[96-wb[0]-wb[2],wb[1],wb[2],wb[3]]];}
    if(meta.rearWindowPolygons){const ps=meta.rearWindowPolygons[0].split(' ').map(v=>v.split(',').map(Number)),lp=ps.map(result.rearPoint).map(rounded),rp=lp.map(([x,y])=>[95-x,y]);meta.rearWindowPolygons=[meta.rearWindowPolygons[0],lp.map(p=>p.join(',')).join(' '),rp.map(p=>p.join(',')).join(' ')];}
    if(id==='scargo'){
      const initial=c.originalMetadata.rearWhiteStripSamples[0],lp={left:initial.left.map(result.rearPoint).map(rounded),right:initial.right.map(result.rearPoint).map(rounded)};
      meta.rearWhiteStripSamples=[initial,lp,{left:lp.right.map(([x,y])=>[95-x,y]),right:lp.left.map(([x,y])=>[95-x,y])}];
      const samples=[];for(const y of[35,43,52,61,70]){const xs=[];for(let x=1;x<48;x++)if(left.rows[y][x]==='#4384D6'&&result.sideLayer.rows[y][x]==='#4384D6'&&!result.rearLayer.rows[y][x])xs.push(x);if(xs.length)samples.push([xs[Math.floor(xs.length/2)],y]);}
      assert(samples.length>=3,'S-Cargo needs visible blue side pixels');meta.sideBlueSamples=[[],samples,samples.map(([x,y])=>[95-x,y])];meta.sideBlueSampleColor='#4384D6';
      for(let f=0;f<3;f++)for(const edge of ['left','right'])for(const[x,y]of meta.rearWhiteStripSamples[f][edge])assert.equal(frames[f].rows[y][x],WHITE,'Rear white strip must remain visible in every pose');
    }
    const title=id==='scargo'?'Nissan S-Cargo tea-plate rear-turn sprite sheet':id==='fiat-player'?'Fiat 500 player rear-turn sprite sheet':`${meta.model} rear-turn sprite sheet`;
    const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="96" viewBox="0 0 288 96" shape-rendering="crispEdges" role="img" aria-label="${title}" data-frame-width="96" data-frame-height="96" data-frame-count="3">`,`  <title>${title}</title>`,`  <metadata>${xml(JSON.stringify(meta))}</metadata>`,c.straightGroup];
    for(let f=1;f<3;f++){svg.push(`  <g id="${f===1?'steering-left':'steering-right'}" data-frame="${f}" transform="translate(${f*96} 0)">`);for(const[x,y,w,h,color]of frames[f].runs())svg.push(`    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);svg.push('  </g>');}svg.push('</svg>');
    const text=svg.join('\n')+'\n';if(id==='scargo')assert(!/siem/i.test(text));
    if(PREVIEW)fs.writeFileSync(`/tmp/vega-turn-preview-${id}.svg`,text);
    assert.equal(text.match(/  <g id="straight"[\s\S]*?<\/g>/)[0],c.straightGroup);
    for(let f=1;f<3;f++){
      const b=boxes[f];for(let y=0;y<h;y++)for(let x=0;x<w;x++)assert.equal(frames[f].rows[b[1]+y][b[0]+x],canonical.rows[sourceLabel[1]+y][sourceLabel[0]+x],`${id}: rear lettering changed`);
      if(cfg.extraLabel){const b=extras[f],s=cfg.extraLabel;for(let y=0;y<s[3];y++)for(let x=0;x<s[2];x++)assert.equal(frames[f].rows[b[1]+y][b[0]+x],canonical.rows[s[1]+y][s[0]+x],'Fiat number plate changed');}
    }
    const exported=await sharp(Buffer.from(text)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(exported.info.width,288);assert.equal(exported.info.height,96);
    for(let i=0;i<exported.data.length;i+=4){const[r,g,b,a]=exported.data.subarray(i,i+4);assert(a===0||a===255);if(a&&b>r+10&&b>g+10)assert.equal(id,'scargo','Unapproved blue pixel');}
    const direct=await sharp(Buffer.from(text),{density:144}).ensureAlpha().raw().toBuffer();
    const nearest=await sharp(exported.data,{raw:exported.info}).resize(576,192,{kernel:'nearest'}).raw().toBuffer();assert(direct.equals(nearest),`${id}: off-grid pixels`);
    generated.push({file:c.file,text});metadata.push({file:c.file,id,...meta});
    const png=await sharp(Buffer.from(text)).png().toBuffer(),x=(index%3)*312,y=Math.floor(index/3)*130;
    contacts.push({input:Buffer.from(`<svg width="312" height="28"><text x="10" y="20" font-family="monospace" font-size="13" fill="#0F3301">${id}</text></svg>`),left:x,top:y},{input:png,left:x+12,top:y+28});
  }
  const contactPath=path.join(NOTES,PREVIEW?'car-turns-preview.png':'car-turns-contact.png');await sharp({create:{width:936,height:650,channels:4,background:'#FFFAEB'}}).composite(contacts).png().toFile(contactPath);
  if(!PREVIEW){for(const g of generated)fs.writeFileSync(path.join(OUT,g.file),g.text);fs.writeFileSync(path.join(NOTES,'car-turn-metadata.json'),JSON.stringify(metadata,null,2)+'\n');const rivals=metadata.filter(m=>m.id!=='fiat-player');fs.writeFileSync(path.join(NOTES,'rival-car-metadata.json'),JSON.stringify(rivals,null,2)+'\n');}
  console.log(JSON.stringify({preview:PREVIEW,contact:contactPath,cars:metadata.map(m=>({id:m.id,turnBounds:m.frameBounds.slice(1),maxVisibleWidth:m.maxVisibleWidth})),checks:'13 exact straight groups preserved;39 native frames;rear lettering/Fiat630 pixel equality;binary alpha;integer2x;bounds/ground;S-Cargo white rear strips/blue sides/no forbidden word'}));
}
main().catch(e=>{console.error(e);process.exit(1);});
