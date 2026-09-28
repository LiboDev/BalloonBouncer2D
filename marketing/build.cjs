// Windows-friendly equivalent of the promo skill's Pillow asset builder.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cfg = require('./promo.config.json');

function cachedPackage(name) {
  try { return require(name); } catch {}
  const base = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
  for (const entry of fs.readdirSync(base)) {
    const p = path.join(base, entry, 'node_modules', name);
    if (fs.existsSync(p)) return require(p);
  }
  throw Error(`Missing ${name}; install it in this project or npm cache.`);
}
const sharp = cachedPackage('sharp');
const base = __dirname;
const raw = path.join(base, 'raw');
const dist = path.join(base, 'dist');
const manifest = [];
const logoSource = path.join(raw, 'logo.png');
const iconSource = path.join(raw, 'icon.png');

const coverSpecs = [
  ['banner-16x9-3840x2160', 'cover-landscape.png', 3840, 2160, [.5,.5], [.03,.04,.42,.30]],
  ['banner-16x9-1920x1080', 'cover-landscape.png', 1920, 1080, [.5,.5], [.03,.04,.42,.30]],
  ['banner-16x9-1280x720', 'cover-landscape.png', 1280, 720, [.5,.5], [.03,.04,.42,.30]],
  ['banner-16x9-480x270', 'cover-landscape.png', 480, 270, [.5,.5], [.03,.04,.45,.33]],
  ['banner-16x9-240x135', 'cover-landscape.png', 240, 135, [.5,.5], null],
  ['banner-9x16-1080x1920', 'cover-portrait.png', 1080, 1920, [.5,.5], [.08,.03,.84,.17]],
  ['banner-9x16-270x480', 'cover-portrait.png', 270, 480, [.5,.5], [.08,.03,.84,.17]],
  ['banner-9x16-135x240', 'cover-portrait.png', 135, 240, [.5,.5], null],
  ['phone-9x19.5-1170x2532', 'cover-portrait.png', 1170, 2532, [.5,.5], [.08,.04,.84,.14]],
  ['tablet-3x4-1536x2048', 'cover-portrait.png', 1536, 2048, [.5,.55], [.10,.03,.80,.17]],
  ['tablet-4x3-2048x1536', 'cover-landscape.png', 2048, 1536, [.5,.5], [.03,.03,.44,.26]],
  ['square-1x1-1080', 'cover-square.png', 1080, 1080, [.5,.5], [.04,.03,.50,.22]],
  ['square-1x1-512', 'cover-square.png', 512, 512, [.5,.5], [.04,.03,.50,.22]],
  ['social-og-1200x630', 'cover-landscape.png', 1200, 630, [.5,.5], [.03,.04,.42,.32]],
  ['social-x-1500x500', 'cover-landscape.png', 1500, 500, [.5,.36], [.02,.08,.34,.50]],
  ['ultrawide-21x9-2560x1080', 'cover-landscape.png', 2560, 1080, [.5,.40], [.03,.05,.34,.34]],
  ['youtube-thumb-1280x720', 'cover-landscape.png', 1280, 720, [.5,.5], [.03,.04,.42,.30]],
];

function target(rel) {
  const full = path.join(dist, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}
function add(rel, w, h) { manifest.push({ file: rel.replaceAll('\\','/'), width:w, height:h }); }
async function save(buffer, rel, w, h) {
  fs.writeFileSync(target(rel), buffer);
  add(rel,w,h);
}
async function crop(file, w, h, focus=[.5,.5]) {
  const m = await sharp(file).metadata();
  const scale = Math.max(w/m.width, h/m.height);
  const rw = Math.max(w,Math.round(m.width*scale)), rh = Math.max(h,Math.round(m.height*scale));
  const left = Math.max(0,Math.min(rw-w,Math.round(rw*focus[0]-w/2)));
  const top = Math.max(0,Math.min(rh-h,Math.round(rh*focus[1]-h/2)));
  return sharp(file).resize(rw,rh,{kernel:'lanczos3'}).extract({left,top,width:w,height:h}).toBuffer();
}
async function fitLogo(w,h) {
  return sharp(logoSource).trim({threshold:1}).resize(w,h,{fit:'inside',withoutEnlargement:false}).png().toBuffer();
}
async function withLogo(image,w,h,box) {
  const bw=Math.round(w*box[2]), bh=Math.round(h*box[3]);
  const logo=await fitLogo(bw,bh), m=await sharp(logo).metadata();
  const x=Math.round(w*box[0]+(bw-m.width)/2), y=Math.round(h*box[1]+(bh-m.height)/2);
  return sharp(image).composite([{input:logo,left:x,top:y}]).jpeg({quality:91,mozjpeg:true}).toBuffer();
}
async function buildLogo() {
  const trimmed=await sharp(logoSource).trim({threshold:1}).png().toBuffer();
  const m=await sharp(trimmed).metadata();
  await save(trimmed,'logo/logo-transparent.png',m.width,m.height);
  for (const w of [1024,512,256]) {
    const b=await sharp(trimmed).resize({width:w,withoutEnlargement:false}).png().toBuffer();
    const z=await sharp(b).metadata();
    await save(b,`logo/logo-${w}w.png`,z.width,z.height);
  }
}
async function buildIcons() {
  const master=await sharp(await crop(iconSource,1024,1024)).flatten({background:'#b5c9fb'}).png().toBuffer();
  const pngs=[];
  for (const s of [1024,512,256,192,180,128,96,64,48,32,16]) {
    const b=await sharp(master).resize(s,s).png().toBuffer();
    await save(b,`icons/icon-${s}.png`,s,s);
    if ([16,32,48,64].includes(s)) pngs.push([s,b]);
  }
  for (const s of [512,256]) for (const kind of ['rounded','circle']) {
    const svg = kind==='circle'
      ? `<svg width="${s}" height="${s}"><circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="white"/></svg>`
      : `<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${Math.round(s*.22)}" fill="white"/></svg>`;
    const b=await sharp(master).resize(s,s).ensureAlpha().composite([{input:Buffer.from(svg),blend:'dest-in'}]).png().toBuffer();
    await save(b,`icons/icon-${kind}-${s}.png`,s,s);
  }
  // ICO file with embedded PNG images at four standard sizes.
  const header=Buffer.alloc(6+pngs.length*16);
  header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(pngs.length,4);
  let offset=header.length;
  pngs.forEach(([s,b],i)=>{
    const p=6+i*16;
    header.writeUInt8(s===256?0:s,p); header.writeUInt8(s===256?0:s,p+1);
    header.writeUInt8(0,p+2); header.writeUInt8(0,p+3);
    header.writeUInt16LE(1,p+4); header.writeUInt16LE(32,p+6);
    header.writeUInt32LE(b.length,p+8); header.writeUInt32LE(offset,p+12);
    offset+=b.length;
  });
  fs.writeFileSync(target('icons/favicon.ico'),Buffer.concat([header,...pngs.map(x=>x[1])]));
  add('icons/favicon.ico',64,64);
}
async function buildCovers() {
  for (const [name,src,w,h,focus,box] of coverSpecs) {
    const img=await crop(path.join(raw,src),w,h,focus);
    const clean=await sharp(img).jpeg({quality:91,mozjpeg:true}).toBuffer();
    await save(clean,`cover-art/clean/${name}.jpg`,w,h);
    if (box) await save(await withLogo(img,w,h,box),`cover-art/with-logo/${name}.jpg`,w,h);
  }
}
async function buildShots() {
  const shotsRoot=path.join(base,'screenshots');
  for (const device of fs.readdirSync(shotsRoot)) {
    const dir=path.join(shotsRoot,device);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter(x=>x.endsWith('.png'))) {
      const src=path.join(dir,file), m=await sharp(src).metadata();
      fs.copyFileSync(src,target(`screenshots/${device}/${file}`));
      add(`screenshots/${device}/${file}`,m.width,m.height);
    }
  }
  for (const [device,tag] of Object.entries(cfg.storeShots.sets)) {
    for (let i=0;i<cfg.storeShots.order.length;i++) {
      const name=cfg.storeShots.order[i];
      const src=path.join(shotsRoot,device,`${name}.png`);
      const m=await sharp(src).metadata();
      const label=name.slice(3);
      const rel=`store/screenshots-${tag}/${String(i+1).padStart(2,'0')}-${label}.jpg`;
      await save(await sharp(src).jpeg({quality:92,mozjpeg:true}).toBuffer(),rel,m.width,m.height);
    }
  }
}
async function contactSheet() {
  const picks=['icons/icon-256.png','cover-art/with-logo/banner-16x9-1920x1080.jpg','cover-art/with-logo/banner-9x16-1080x1920.jpg',
    'cover-art/with-logo/square-1x1-1080.jpg','cover-art/with-logo/social-x-1500x500.jpg',
    'store/screenshots-16x9/01-fireball.jpg','store/screenshots-16x9/02-lightning-orb.jpg','store/screenshots-16x9/03-black-hole.jpg',
    'store/screenshots-9x16/01-fireball.jpg','store/screenshots-9x16/02-lightning-orb.jpg','store/screenshots-9x16/03-black-hole.jpg',
    'store/screenshots-9x16/04-results.jpg'];
  const cellW=400,cellH=300,pad=16,cols=4,rows=Math.ceil(picks.length/cols);
  const comps=[];
  for (let i=0;i<picks.length;i++) {
    const thumb=await sharp(path.join(dist,picks[i])).resize(cellW,cellH,{fit:'inside'}).png().toBuffer();
    const m=await sharp(thumb).metadata();
    comps.push({input:thumb,left:pad+(i%cols)*(cellW+pad)+Math.round((cellW-m.width)/2),top:pad+Math.floor(i/cols)*(cellH+pad)+Math.round((cellH-m.height)/2)});
  }
  const w=cols*(cellW+pad)+pad,h=rows*(cellH+pad)+pad;
  const b=await sharp({create:{width:w,height:h,channels:3,background:'#182447'}}).composite(comps).jpeg({quality:86}).toBuffer();
  await save(b,'contact-sheet.jpg',w,h);
}
async function addVideos() {
  const dir=path.join(dist,'previews');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const match=file.match(/(\d+)x(\d+)\.(mp4|webm|gif)$/);
    if (match) add(`previews/${file}`,Number(match[1]),Number(match[2]));
  }
}
async function main() {
  // Preserve encoded previews when rebuilding still images.
  const previousVideos=path.join(base,'encoded-previews');
  if (fs.existsSync(dist)) fs.rmSync(dist,{recursive:true,force:true});
  await buildLogo(); await buildIcons(); await buildCovers(); await buildShots();
  if (fs.existsSync(previousVideos)) {
    for (const f of fs.readdirSync(previousVideos)) fs.copyFileSync(path.join(previousVideos,f),target(`previews/${f}`));
  }
  await addVideos(); await contactSheet();
  fs.writeFileSync(target('manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Built ${manifest.length} assets in ${dist}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
