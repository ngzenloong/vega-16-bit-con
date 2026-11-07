/**
 * Original full side-profile pixel art. No runtime or rear-sheet writes.
 * node tools/art/generate-car-profiles.mjs
 *
 * Frame 0 faces left; frame 1 faces right. All art is rasterized to an
 * integer 96px grid before being exported as opaque SVG rectangle runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'public/assets/vega');
const notes = path.join(root, 'tools/art/metadata');
const W = 96;
const P = {
  ink:'#0F3301', black:'#182218', tire:'#293127', rubber:'#41493C',
  white:'#FFFAEB', cream:'#DFDEC4', metal:'#A5AC96',
  glass:'#293F31', glassLight:'#59705B', glassHighlight:'#8A9C7D',
  leaf:'#0D5500', leafLight:'#49832C', leafDark:'#173D12',
  yellow:'#FFD11B', yellowLight:'#FFE577', yellowDark:'#B98B18',
  lime:'#D5FB19', limeDark:'#8CA522', orange:'#FF9823',
  orangeDark:'#B85D18', red:'#CA4E2C', redLight:'#FF8250',
};

class Pixels {
  constructor() {
    this.rows = Array.from({length:W}, () => Array(W).fill(null));
    this.tags = Array.from({length:W}, () => Array(W).fill(null));
    this.tag = 'body';
    this.windows = [];
  }
  dot(x,y,color) {
    x=Math.round(x); y=Math.round(y);
    if(x>=0&&x<W&&y>=0&&y<W) {
      this.rows[y][x]=color; this.tags[y][x]=color?this.tag:null;
    }
  }
  r(x,y,w,h,color) {
    for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) this.dot(xx,yy,color);
  }
  l(a,b,color=P.ink,thickness=1) {
    let [x,y]=a; const [tx,ty]=b, dx=Math.abs(tx-x), sx=x<tx?1:-1;
    const dy=-Math.abs(ty-y),sy=y<ty?1:-1; let error=dx+dy;
    for(;;) {this.r(x,y,thickness,thickness,color);if(x===tx&&y===ty)break;
      const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
  }
  p(points,color,outline=P.ink) {
    const minY=Math.min(...points.map(p=>p[1])), maxY=Math.max(...points.map(p=>p[1]));
    for(let y=minY;y<=maxY;y++) {
      const intersections=[],scan=y+.5;
      points.forEach((a,i)=>{const b=points[(i+1)%points.length];
        if((a[1]<=scan&&scan<b[1])||(b[1]<=scan&&scan<a[1]))
          intersections.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));});
      intersections.sort((a,b)=>a-b);
      for(let i=0;i<intersections.length;i+=2)
        this.r(Math.ceil(intersections[i]-.5),y,Math.ceil(intersections[i+1]-.5)-Math.ceil(intersections[i]-.5),1,color);
    }
    if(outline) points.forEach((a,i)=>this.l(a,points[(i+1)%points.length],outline));
  }
  ellipse(x,y,rx,ry,color) {
    for(let yy=y-ry;yy<=y+ry;yy++) for(let xx=x-rx;xx<=x+rx;xx++)
      if(((xx-x)/rx)**2+((yy-y)/ry)**2<=1.04)this.dot(xx,yy,color);
  }
  glass(points) {
    this.p(points,P.glass);
    const box=boundsOf(points);this.windows.push(box);
    for(let y=box[1]+2;y<box[1]+box[3]-1;y++) for(let x=box[0]+1;x<box[0]+box[2]-1;x++)
      if(this.rows[y][x]===P.glass) {
        if(y===box[1]+2)this.dot(x,y,P.glassHighlight);
        else if(y<box[1]+box[3]*.48)this.dot(x,y,P.glassLight);
      }
  }
  arch(x,r,trim) {
    const y=90-r;
    this.tag='body';
    for(let yy=y-r-3;yy<=y+1;yy++) for(let xx=x-r-3;xx<=x+r+3;xx++) {
      const distance=(xx-x)**2+(yy-y)**2;
      if(distance<=(r+3)**2&&yy<=y)this.dot(xx,yy,trim);
      if(distance<=(r+1)**2)this.dot(xx,yy,null);
    }
    this.tag='wheel';
    this.ellipse(x,y,r,r,P.black);
    this.ellipse(x,y,r-2,r-2,P.tire);
    this.ellipse(x,y,r-3,r-3,P.metal);
    this.ellipse(x,y,r-5,r-5,P.rubber);
    this.r(x-1,y-1,3,3,P.cream);
    this.l([x-r+3,y-2],[x-r+4,y-4],P.white);
    this.tag='body';
  }
  mirror() {
    const copy=new Pixels();
    copy.rows=this.rows.map(r=>[...r].reverse());
    copy.tags=this.tags.map(r=>[...r].reverse());
    copy.windows=this.windows.map(([x,y,w,h])=>[96-x-w,y,w,h]);
    return copy;
  }
  bounds(body=false) {
    const points=[];
    for(let y=0;y<W;y++)for(let x=0;x<W;x++)
      if(this.rows[y][x]&&(!body||this.tags[y][x]!=='wheel'))points.push([x,y]);
    return boundsOf(points);
  }
  runs() {
    const result=[];
    for(let y=0;y<W;y++)for(let x=0;x<W;) {
      const color=this.rows[y][x],start=x;
      while(x<W&&this.rows[y][x]===color)x++;
      if(color)result.push([start,y,x-start,1,color]);
    }
    return result;
  }
}
function boundsOf(points) {
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1];
}
function handle(c,x,y,color=P.cream){c.r(x,y,6,2,P.ink);c.r(x+1,y,4,1,color);}
function vent(c,x,y,count,color=P.ink){for(let i=0;i<count;i++)c.r(x+i*3,y,1,5,color);}
function sill(c,x,y,width,color=P.cream){c.r(x,y,width,2,color);c.r(x+2,y+2,width-4,1,P.ink);}
function finishWheels(c,front,rear,r,trim=P.ink) {c.arch(front,r,trim);c.arch(rear,r,trim);}
const models=[];
function model(id,name,draw,front,rear,r,identity,extra={}) {models.push({id,name,draw,front,rear,r,identity,...extra});}

model('mini','Classic Mini Cooper',c=>{
  c.p([[9,65],[24,62],[31,43],[38,39],[65,39],[73,44],[79,60],[87,65],[87,81],[11,81]],P.leaf);
  c.p([[31,43],[36,38],[66,38],[72,42],[72,46],[29,46]],P.white);
  c.l([37,39],[65,39],P.cream);
  c.glass([[33,47],[48,47],[48,60],[27,60]]);
  c.glass([[52,47],[66,47],[73,60],[52,60]]);
  c.r(49,46,3,16,P.cream);
  c.l([31,62],[31,79],P.leafDark);c.l([58,62],[58,79],P.leafDark);
  c.l([32,78],[58,78],P.leafLight);handle(c,52,64);
  c.r(9,65,16,2,P.leafLight);c.r(77,64,9,2,P.leafLight);
  c.r(8,68,3,6,P.white);c.r(85,66,3,7,P.red);
  c.r(6,77,8,3,P.cream);c.r(84,77,6,3,P.cream);
  c.r(25,59,4,3,P.ink);c.r(23,57,5,3,P.cream);
  sill(c,12,79,74);c.r(70,66,3,3,P.leafDark);
  finishWheels(c,24,74,8,P.leafDark);
},24,74,8,'Short upright two-door saloon, separate bonnet and boot, cream roof, chrome trim.',{door:[31,61,28,18]});

model('az1','Autozam AZ-1',c=>{
  c.p([[7,72],[13,67],[28,64],[39,51],[47,48],[63,48],[75,61],[87,65],[91,76],[87,83],[9,83]],P.orange);
  c.p([[30,64],[40,50],[46,47],[62,47],[76,62],[76,65]],P.black);
  c.glass([[40,52],[50,51],[50,64],[31,64]]);
  c.glass([[54,51],[62,51],[71,62],[71,64],[54,64]]);
  c.l([51,50],[51,66],P.ink,2);
  c.p([[32,66],[70,66],[67,79],[30,79]],P.orange,P.orangeDark);
  c.l([33,67],[33,77],P.orangeDark);handle(c,60,68,P.metal);
  c.p([[69,69],[79,67],[82,76],[71,77]],P.black);vent(c,72,69,3,P.metal);
  c.l([10,74],[28,70],P.orangeDark);c.r(8,70,9,2,P.cream);
  c.r(87,68,3,5,P.red);c.r(7,80,82,4,P.black);
  c.r(34,79,29,2,P.orangeDark);c.r(29,62,5,3,P.black);
  finishWheels(c,23,76,8,P.orangeDark);
},23,76,8,'Low wedge-shaped gullwing micro-coupe, black canopy and deep mid-engine side intake.',{door:[32,65,37,15]});

model('isetta','BMW Isetta 300 Export',c=>{
  c.p([[21,62],[24,49],[30,38],[40,33],[53,34],[63,41],[71,57],[75,72],[72,81],[25,82],[20,74]],P.yellow);
  c.p([[27,48],[33,37],[41,32],[53,33],[63,40],[68,49]],P.cream);
  c.glass([[28,49],[35,39],[43,37],[46,51],[45,59],[26,59]]);
  c.glass([[49,38],[55,40],[63,48],[67,60],[49,60]]);
  c.l([46,38],[47,61],P.yellowDark,2);
  c.p([[25,61],[45,61],[46,76],[25,77]],P.yellow,P.yellowDark);
  c.l([24,61],[22,72],P.white);handle(c,30,63);
  c.r(47,63,3,2,P.cream);vent(c,58,68,4,P.yellowDark);
  c.r(19,68,4,5,P.white);c.r(72,70,3,4,P.red);
  c.r(20,78,10,3,P.cream);c.r(69,78,8,3,P.cream);
  c.r(25,54,3,2,P.ink);c.r(22,52,4,3,P.metal);
  c.l([30,79],[67,79],P.yellowLight);
  finishWheels(c,32,65,8,P.yellowDark);
},32,65,8,'Egg-shaped cabin with front-door seam, curved glazing and short tapering engine tail.',{door:[22,57,25,21]});

model('p50','Peel P50',c=>{
  c.p([[28,67],[30,50],[36,42],[51,41],[60,47],[66,63],[68,78],[63,83],[31,83],[27,76]],P.white);
  c.glass([[33,51],[37,45],[46,45],[46,61],[32,61]]);
  c.glass([[50,45],[56,49],[61,60],[50,60]]);
  c.l([48,45],[48,64],P.cream,2);
  c.p([[31,64],[51,64],[51,79],[30,79]],P.white,P.metal);
  handle(c,43,66,P.metal);c.r(31,79,32,2,P.cream);
  c.r(26,68,4,5,P.cream);c.r(65,72,3,3,P.red);
  c.r(27,78,5,3,P.ink);c.r(65,76,4,2,P.metal);
  c.l([57,65],[63,74],P.metal);c.r(60,80,7,2,P.ink);
  c.r(31,58,3,2,P.ink);c.r(28,56,4,3,P.cream);
  finishWheels(c,35,60,6,P.cream);
},35,60,6,'Tiny single-seat shell and short wheelbase; one visible front wheel and the single rear wheel.',{door:[30,62,22,18],wheelLayout:'three wheels in total; side projection shows one front wheel and the centered rear wheel'});

model('sambar-van','Subaru Sambar van',c=>{
  c.p([[8,50],[12,32],[18,26],[80,26],[87,31],[90,77],[86,83],[9,83],[6,75]],P.leaf);
  c.p([[13,31],[18,25],[80,25],[86,30],[86,34],[12,34]],P.lime);
  c.l([20,27],[79,27],P.yellowLight);
  c.glass([[13,37],[30,37],[30,55],[10,55]]);
  c.glass([[35,37],[58,37],[58,55],[35,55]]);
  c.glass([[63,37],[81,37],[84,55],[63,55]]);
  c.r(31,34,3,23,P.leafDark);c.r(59,34,3,23,P.leafDark);
  c.l([32,58],[32,80],P.leafDark);c.l([60,58],[60,79],P.leafDark);
  c.l([35,61],[82,61],P.leafLight);c.l([36,77],[82,77],P.leafDark);
  c.l([82,57],[84,78],P.leafDark);handle(c,24,59);handle(c,54,59);
  c.r(33,65,48,1,P.metal);c.r(77,72,7,4,P.leafDark);vent(c,77,72,3,P.metal);
  c.r(7,62,3,5,P.cream);c.r(88,68,2,8,P.red);
  c.r(5,77,8,5,P.metal);c.r(84,78,8,4,P.metal);
  c.r(6,48,6,3,P.black);c.r(6,45,4,5,P.metal);
  sill(c,11,80,73,P.metal);finishWheels(c,22,76,8,P.leafDark);
},22,76,8,'Tall cab-over van, nearly flat nose, three side glass sections and a sliding cargo door.',{door:[33,56,49,23]});

model('sambar-truck','Subaru Sambar kei truck',c=>{
  c.p([[8,57],[11,38],[17,32],[40,32],[45,39],[46,80],[10,82],[7,76]],P.white);
  c.p([[12,38],[17,31],[39,31],[44,37]],P.cream);
  c.glass([[14,41],[36,41],[39,55],[11,55]]);
  c.l([38,40],[40,79],P.metal);c.l([12,59],[37,59],P.cream);
  c.p([[13,60],[36,60],[38,78],[12,78]],P.white,P.metal);handle(c,30,62);
  c.p([[45,59],[88,59],[90,78],[84,82],[45,82]],P.cream);
  c.r(46,57,42,4,P.metal);c.r(48,58,38,1,P.white);
  c.p([[48,62],[86,62],[85,75],[48,75]],P.white,P.metal);
  for(let x=52;x<=82;x+=7)c.r(x,65,1,9,P.cream);
  c.r(45,75,44,3,P.metal);c.r(47,61,2,18,P.ink);c.r(85,61,2,18,P.ink);
  c.r(5,68,5,5,P.cream);c.r(87,76,4,4,P.red);
  c.r(6,78,10,4,P.metal);c.r(82,80,9,3,P.black);
  c.r(6,50,6,2,P.black);c.r(5,47,4,5,P.metal);
  finishWheels(c,22,76,8,P.metal);
},22,76,8,'Cab-over two-seat truck with a separate long open bed, ribbed drop side and tailgate latches.',{door:[12,57,28,22],bed:[46,57,43,22]});

model('midget','Daihatsu Midget II pickup',c=>{
  c.p([[17,65],[22,43],[28,34],[44,34],[49,42],[49,79],[21,82],[16,76]],P.orange);
  c.p([[23,42],[29,33],[43,33],[48,41]],P.orangeDark);
  c.glass([[26,44],[42,44],[45,58],[21,58]]);
  c.l([43,43],[45,77],P.orangeDark);c.r(22,60,21,1,P.yellowLight);
  c.p([[23,63],[42,63],[44,78],[21,78]],P.orange,P.orangeDark);handle(c,37,64);
  c.p([[49,59],[78,59],[82,67],[82,80],[49,81]],P.leaf);
  c.r(49,56,30,3,P.leafDark);c.r(51,57,26,1,P.leafLight);
  c.r(51,62,27,13,P.leafDark);
  for(let x=54;x<78;x+=6)c.r(x,64,1,10,P.leafLight);
  c.r(48,75,34,4,P.leaf);c.r(50,59,2,19,P.metal);c.r(77,59,2,19,P.metal);
  c.ellipse(17,65,4,9,P.black);c.ellipse(17,65,2,5,P.rubber);
  c.r(14,76,10,5,P.black);c.r(78,77,5,4,P.red);
  c.r(17,52,6,2,P.black);c.r(16,49,4,5,P.cream);
  finishWheels(c,29,70,7,P.orangeDark);
},29,70,7,'Narrow one-seat cab, visible front-mounted spare edge and short open green cargo bed.',{door:[22,60,23,19],bed:[49,56,32,23]});

model('be1','Nissan Be-1',c=>{
  c.p([[8,65],[15,60],[29,59],[37,44],[45,40],[66,40],[77,45],[84,59],[89,66],[89,80],[10,81]],P.yellow);
  c.p([[36,45],[44,39],[65,39],[75,43],[79,48],[36,48]],P.yellowDark);
  c.l([45,41],[65,41],P.yellowLight);
  c.glass([[39,47],[54,45],[55,59],[31,59]]);
  c.glass([[58,45],[68,45],[77,51],[79,59],[58,59]]);
  c.r(55,44,3,17,P.yellowDark);
  c.l([36,62],[36,79],P.yellowDark);c.l([66,61],[66,79],P.yellowDark);
  c.l([37,77],[65,77],P.yellowLight);handle(c,59,64,P.black);
  c.r(10,63,18,2,P.yellowLight);c.r(8,68,5,5,P.white);
  c.r(85,66,4,7,P.red);c.r(7,76,82,5,P.black);
  c.r(13,77,73,1,P.rubber);c.r(75,64,4,3,P.yellowDark);
  c.r(30,58,6,3,P.black);
  finishWheels(c,23,75,8,P.yellowDark);
},23,75,8,'Rounded compact hatch with a conventional bonnet, broad side glass, large black rub strip and short rear hatch.',{door:[36,60,31,19]});

model('pao','Nissan Pao',c=>{
  c.p([[6,65],[12,59],[29,57],[38,40],[44,36],[69,36],[80,44],[86,60],[90,69],[88,82],[7,82]],P.leafLight);
  c.p([[38,41],[44,35],[68,35],[77,40],[78,44],[37,44]],P.cream);
  c.r(45,35,23,4,P.rubber);c.r(47,36,19,1,P.metal);
  c.glass([[40,45],[55,44],[55,59],[31,59]]);
  c.glass([[59,44],[70,44],[78,50],[79,59],[59,59]]);
  c.r(56,42,3,19,P.cream);
  c.l([37,61],[37,79],P.leafDark);c.l([65,61],[65,79],P.leafDark);
  c.r(36,62,4,3,P.cream);c.r(36,73,4,3,P.cream);
  handle(c,58,64,P.cream);c.l([39,78],[63,78],P.leafDark);
  c.r(9,68,76,2,P.cream);c.r(11,72,73,1,P.leafDark);
  c.r(78,63,4,4,P.cream);c.r(79,64,2,2,P.leafDark);
  c.r(6,67,5,6,P.white);c.r(86,65,3,8,P.red);
  c.r(4,78,10,4,P.cream);c.r(84,78,8,4,P.cream);
  c.r(30,57,7,3,P.cream);c.r(29,56,4,3,P.black);
  finishWheels(c,23,76,8,P.cream);
},23,76,8,'Canvas-roof retro hatch with upright glass, external door hinges, cream belt trim and a visible fuel flap.',{door:[37,60,29,20]});

model('figaro','Nissan Figaro',c=>{
  c.p([[5,68],[11,62],[28,59],[39,44],[47,41],[61,42],[72,53],[77,60],[87,60],[92,67],[90,80],[6,81]],P.leafLight);
  c.p([[36,46],[44,39],[60,40],[68,47],[73,57],[68,60],[36,60]],P.white);
  c.l([46,41],[59,42],P.cream);
  c.glass([[40,47],[49,44],[52,57],[33,58]]);
  c.glass([[55,44],[61,47],[67,56],[55,57]]);
  c.r(52,43,3,17,P.cream);
  c.p([[32,61],[65,61],[69,78],[31,78]],P.leafLight,P.leafDark);
  handle(c,57,64,P.cream);c.l([33,77],[66,77],P.cream);
  c.l([10,65],[29,63],P.cream);c.l([75,62],[87,62],P.cream);
  c.r(8,71,80,2,P.cream);c.r(11,74,74,1,P.leafDark);
  c.r(5,67,5,6,P.white);c.r(88,65,3,9,P.red);
  c.r(4,78,11,3,P.cream);c.r(83,78,10,3,P.cream);
  c.r(29,59,5,3,P.cream);c.ellipse(30,57,2,2,P.metal);
  finishWheels(c,22,77,8,P.cream);
  for(const x of [22,77]){c.tag='wheel';c.ellipse(x,82,5,5,P.white);c.ellipse(x,82,3,3,P.metal);c.r(x,82,1,1,P.ink);c.tag='body';}
},22,77,8,'Long rounded bonnet and separate boot, compact ivory hardtop and chrome/whitewall details.',{door:[32,60,36,19]});

model('scargo','Nissan S-Cargo Yokohama',c=>{
  const blue='#4384D6', light='#7BADE1', dark='#2166C3', roof='#2D4560';
  c.p([[5,72],[9,64],[25,61],[31,49],[40,35],[52,25],[72,23],[81,26],[87,34],[90,78],[87,83],[7,83]],blue);
  c.p([[39,36],[51,25],[70,22],[80,25],[85,29],[85,33],[76,29],[55,29]],roof);
  c.l([53,25],[72,24],'#435E78');
  c.glass([[32,51],[42,37],[54,31],[60,31],[60,56],[29,59]]);
  c.l([61,31],[63,79],dark);
  c.l([29,61],[29,78],dark);c.l([30,79],[62,79],dark);
  c.l([10,64],[25,63],light);c.l([32,60],[60,59],light);
  handle(c,54,61,P.cream);
  c.ellipse(75,43,9,9,P.cream);c.ellipse(75,43,8,8,dark);
  c.ellipse(75,43,6,6,roof);c.ellipse(75,42,5,4,'#365F7B');
  c.l([70,44],[79,44],blue);c.r(70,39,4,1,light);
  for(const [x,y] of [[75,32],[75,53],[64,43],[85,43]])c.r(x,y,1,2,P.cream);
  c.r(70,62,4,3,dark);c.r(71,62,2,1,light);
  c.p([[7,74],[20,74],[24,78],[25,82],[7,82],[4,80],[4,76]],P.white);
  c.r(87,77,6,6,P.white);c.r(88,64,2,9,P.red);
  // Rear edge only: no white stripe across the blue cargo side.
  c.l([87,34],[89,75],P.white);
  c.r(28,56,4,2,P.black);c.r(26,53,5,4,roof);
  c.l([32,81],[64,81],dark);
  finishWheels(c,23,77,9,P.white);
},23,77,9,'Tall curved marine-blue cargo shell, dark roof, large cab glass, blue side door and circular nautical porthole.',{door:[29,58,34,22],porthole:{center:[75,43],radius:9},rearPlateGlyph:'茶',rearPlateVisible:false,blueException:true});

model('fiat-player','Fiat 500 player',c=>{
  const body='#D8DC20',light='#EEF15A',dark='#A9B315',edge='#252C20';
  c.p([[7,68],[13,62],[26,59],[33,44],[45,35],[63,34],[73,40],[82,53],[88,66],[89,79],[83,83],[10,83]],body,edge);
  c.p([[32,45],[43,35],[61,33],[71,38],[77,45],[73,47],[45,39]],light,edge);
  c.glass([[36,46],[46,40],[56,40],[56,59],[29,59]]);
  c.glass([[61,40],[69,43],[77,54],[78,59],[61,59]]);
  c.r(57,39,4,23,edge);
  c.l([33,62],[33,79],dark);c.l([66,62],[68,79],dark);
  c.l([34,78],[65,78],light);handle(c,58,61,P.cream);
  c.r(12,65,15,2,light);c.r(8,68,5,5,P.white);
  c.p([[83,61],[86,63],[88,72],[84,73]],'#C8352A',edge);
  c.r(84,65,2,4,'#F36E3B');c.r(7,78,9,4,dark);c.r(83,79,8,3,edge);
  c.r(29,58,6,3,edge);c.r(28,55,5,3,body);
  sill(c,13,80,70,dark);finishWheels(c,24,75,8,dark);
},24,75,8,'Rounded modern Fiat 500 hatch, short bonnet, arched roof, split side glass and photo-matched lime-yellow event livery.',{door:[33,60,35,20],player:true,bodyColor:'#D8DC20'});

const font={
  P:['110','101','110','100','100'],o:['000','111','101','101','111'],
  s:['000','111','100','001','111'],t:['010','111','010','010','011'],
  S:['111','100','111','001','111'],I:['111','010','010','010','111'],
  E:['111','100','110','100','111'],M:['10001','11011','10101','10001','10001'],
  '.':['0','0','0','0','1'],c:['000','111','100','100','111'],
  m:['00000','11011','10101','10101','10101'],
};
function stampText(c,text,left,top,color) {
  let x=left;
  for(const char of text){const rows=font[char];if(!rows)throw Error('Unknown bitmap letter '+char);
    rows.forEach((row,y)=>[...row].forEach((bit,dx)=>{if(bit==='1')c.dot(x+dx,top+y,color);}));
    x+=rows[0].length+1;
  }
  return [left,top,x-left-1,5];
}
// White mask sampled from the already approved original rear-sheet daisy.
function originalDaisyMask() {
  const svg=fs.readFileSync(path.join(out,'fiat-player.svg'),'utf8');
  const group=svg.match(/<g\b[^>]*id="straight"[^>]*>([\s\S]*?)<\/g>/)[1];
  const pixels=new Pixels();
  for(const rect of group.matchAll(/<rect\b([^>]+)\/>/g)) {
    const attrs=Object.fromEntries([...rect[1].matchAll(/([\w-]+)="([^"]+)"/g)].map(m=>[m[1],m[2]]));
    pixels.r(+attrs.x,+attrs.y,+attrs.width,+attrs.height,attrs.fill);
  }
  return Array.from({length:9},(_,y)=>Array.from({length:12},(_,x)=>pixels.rows[66+y][14+x]===P.white));
}
const daisy=originalDaisyMask();
function stampPlayer(c) {
  c.tag='decal';
  daisy.forEach((row,y)=>row.forEach((on,x)=>{if(on)c.dot(14+x,64+y,P.white);}));
  const textBox=stampText(c,'PostSIEM.com',29,66,'#252C20');
  c.tag='body';
  return {wordmarkBox:textBox,daisyBox:[14,64,12,9],daisySource:'Approved fiat-player.svg straight frame white mask [14,66,12,9]'};
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function mirrorBox([x,y,w,h]){return [96-x-w,y,w,h];}
function svgFor(m,frames,metadata) {
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="192" height="96" viewBox="0 0 192 96" shape-rendering="crispEdges" role="img" aria-label="'+escape(m.name+' full side views, nose left and nose right')+'" data-frame-width="96" data-frame-height="96" data-frame-count="2">\n';
  svg+='  <title>'+escape(m.name+' — full side profiles')+'</title>\n  <metadata>'+escape(JSON.stringify(metadata))+'</metadata>\n';
  frames.forEach((c,i)=>{svg+='  <g id="'+(i?'side-right':'side-left')+'" data-frame="'+i+'" transform="translate('+(i*96)+' 0)">\n';
    for(const [x,y,w,h,color] of c.runs())svg+='    <rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'"/>\n';
    svg+='  </g>\n';});
  return svg+'</svg>\n';
}
const metadata=[];
for(const m of models) {
  const left=new Pixels();m.draw(left);
  const right=left.mirror();
  const decals=m.player?[stampPlayer(left),stampPlayer(right)]:[];
  const frames=[left,right],file=m.id==='fiat-player'?'fiat-player-side.svg':'car-'+m.id+'-side.svg';
  const meta={
    id:m.id,model:m.name,file,frameWidth:96,frameHeight:96,
    frames:['side-left','side-right'],frameOffsets:[0,96],fps:0,groundAnchor:[48,90],
    frameBounds:frames.map(c=>c.bounds()),bodyBounds:frames.map(c=>c.bounds(true)),
    wheels:[{front:[m.front,90-m.r],rear:[m.rear,90-m.r],radius:m.r},{front:[95-m.front,90-m.r],rear:[95-m.rear,90-m.r],radius:m.r}],
    sideWindowBoxes:frames.map(c=>c.windows),doorBoxes:[m.door,mirrorBox(m.door)],
    bodyTop:Math.min(...frames.map(c=>c.bounds(true)[1])),bodyBottom:Math.max(...frames.map(c=>{const b=c.bounds(true);return b[1]+b[3]-1;})),
    identity:m.identity,frontEnd:['left','right'],rearEnd:['right','left'],
    rearPlateVisible:false,
    rendering:'Two complete profile states, not an autoplay strip. Use square frames and shared [48,90] ground anchor. Do not stretch to a common opaque width.',
    construction:'Original integer-grid illustration. Flat opaque pixels; no embedded photographs, manufacturer badges, external resources or fonts.',
  };
  if(m.bed)meta.bedBoxes=[m.bed,mirrorBox(m.bed)];
  if(m.wheelLayout)meta.wheelLayout=m.wheelLayout;
  if(m.player)Object.assign(meta,{bodyColor:m.bodyColor,lettering:'PostSIEM.com',decals});
  if(m.blueException)Object.assign(meta,{bodyColor:'#4384D6',bodyHighlight:'#7BADE1',bodyShade:'#2166C3',roofColor:'#2D4560',porthole:m.porthole,portholeCenters:[[75,43],[20,43]],rearPlateGlyph:'茶',livery:'User-supplied Yokohama Version reference. Blue side panels; white bumper/arches; narrow white trim only at the rear edge. Rear plate is not visible from an orthographic side.',sourcePhotos:['91DE6246-D45D-4898-9559-780AA18A3652/1-Photo-1.jpg','2B6ABA25-A49F-4774-AF84-823F7772D107/1-Photo-1.jpg']});
  fs.writeFileSync(path.join(out,file),svgFor(m,frames,meta));metadata.push(meta);
}
fs.mkdirSync(notes,{recursive:true});
fs.writeFileSync(path.join(notes,'car-profile-metadata.json'),JSON.stringify(metadata,null,2)+'\n');

const actual=[],large=[],silhouettes=new Set();
const label=(s,width=240)=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="24"><text x="8" y="16" font-family="monospace" font-size="12" fill="#0F3301">'+escape(s)+'</text></svg>');
for(let i=0;i<metadata.length;i++){
  const m=metadata[i],buf=fs.readFileSync(path.join(out,m.file)),raw=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const svg=buf.toString();
  if(/<(?:image|text|script|foreignObject|filter|use)\b|(?:href|onload)=/i.test(svg))throw Error(m.id+' external or non-pixel SVG content');
  if(m.id==='scargo'&&/siem/i.test(svg))throw Error('Cargo profile contains prohibited lettering');
  for(const rect of svg.matchAll(/<rect\b([^>]+)\/>/g)) {
    const attrs=Object.fromEntries([...rect[1].matchAll(/([\w-]+)="([^"]+)"/g)].map(a=>[a[1],a[2]]));
    if(!['x','y','width','height'].every(k=>/^\d+$/.test(attrs[k]))||+attrs.width===0||+attrs.height===0)throw Error(m.id+' non-integer pixel rectangle');
  }
  if(raw.info.width!==192||raw.info.height!==96)throw Error(m.id+' dimensions');
  let silhouette='';
  for(let y=0;y<96;y++)for(let x=0;x<96;x++) {
    const leftAlpha=raw.data[(y*192+x)*4+3],rightAlpha=raw.data[(y*192+191-x)*4+3];
    if(leftAlpha!==rightAlpha)throw Error(m.id+' mirrored outline mismatch');
    silhouette+=leftAlpha?'1':'0';
  }
  if(silhouettes.has(silhouette))throw Error(m.id+' repeated model silhouette');
  silhouettes.add(silhouette);
  for(let p=0;p<raw.data.length;p+=4) {
    const [r,g,b,a]=raw.data.subarray(p,p+4);
    if(a!==0&&a!==255)throw Error(m.id+' partial alpha');
    if(a&&b>r+10&&b>g+10&&m.id!=='scargo')throw Error(m.id+' unexpected blue');
  }
  if(m.frameBounds.some(b=>b[1]+b[3]-1!==90))throw Error(m.id+' ground mismatch');
  const direct=await sharp(buf,{density:144}).ensureAlpha().raw().toBuffer();
  const nearest=await sharp(raw.data,{raw:raw.info}).resize(384,192,{kernel:'nearest'}).raw().toBuffer();
  if(!direct.equals(nearest))throw Error(m.id+' non-integer scaling');
  const x=(i%3)*240,y=Math.floor(i/3)*128;
  actual.push({input:label(m.model),left:x,top:y},{input:await sharp(buf).png().toBuffer(),left:x+24,top:y+24});
  const lx=(i%2)*420,ly=Math.floor(i/2)*230;
  large.push({input:label(m.model,420),left:lx,top:ly},{input:await sharp(buf).resize(384,192,{kernel:'nearest'}).png().toBuffer(),left:lx+18,top:ly+28});
}
await sharp({create:{width:720,height:640,channels:4,background:P.white}}).composite(actual).png().toFile(path.join(notes,'car-profiles-native.png'));
await sharp({create:{width:840,height:1610,channels:4,background:P.white}}).composite(large).png().toFile(path.join(notes,'car-profiles-2x.png'));
console.log(JSON.stringify({models:metadata.length,sheets:metadata.map(m=>m.file),metadata:path.join(notes,'car-profile-metadata.json'),nativeContact:path.join(notes,'car-profiles-native.png'),checks:'192×96 sheets; two 96×96 frames; 12 distinct mirrored silhouettes; binary alpha; integer rectangles; direct 2× pixels equal nearest-neighbor scaling; shared ground 90; no external SVG resources/fonts/scripts; blue restricted to the user-specified cargo livery; cargo prohibited-lettering absence'},null,2));
