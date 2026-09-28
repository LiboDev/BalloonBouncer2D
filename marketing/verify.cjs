const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
function cached(name) {
  try{return require(name);}catch{}
  const root=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');
  for(const d of fs.readdirSync(root)) {
    const p=path.join(root,d,'node_modules',name);
    if(fs.existsSync(p))return require(p);
  }
  throw Error(`Missing ${name}`);
}
const sharp=cached('sharp');
const {chromium}=cached('playwright');
const dist=path.join(__dirname,'dist');
const list=JSON.parse(fs.readFileSync(path.join(dist,'manifest.json')));
function mp4Timing(file){
  const b=fs.readFileSync(file);let samples=0,timescale=0,duration=0;
  function scan(start,end){for(let p=start;p+8<=end;){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8);if(n<8||p+n>end)break;
    if(t==='stsz')samples=b.readUInt32BE(p+16);
    if(t==='mdhd'){timescale=b.readUInt32BE(p+20);duration=b.readUInt32BE(p+24);}
    if(['moov','trak','mdia','minf','stbl'].includes(t))scan(p+8,p+n);p+=n;
  }}scan(0,b.length);return {samples,fps:samples*timescale/duration};
}
async function main() {
  const errors=[];
  for(const x of list) {
    const file=path.join(dist,x.file);
    if(!fs.existsSync(file)) {errors.push(`missing ${x.file}`);continue;}
    if(/\.(png|jpg|gif)$/.test(file)) {
      try {
        const m=await sharp(file,{animated:false}).metadata();
        if(m.width!==x.width||m.height!==x.height)errors.push(`wrong size ${x.file}: ${m.width}x${m.height}`);
        if(/^icons\/icon-\d+\.png$/.test(x.file)&&m.hasAlpha)errors.push(`transparent store icon ${x.file}`);
        if(file.endsWith('.gif'))await sharp(file,{animated:true}).extract({left:0,top:0,width:x.width,height:x.height}).raw().toBuffer();
      }catch(e){errors.push(`invalid image ${x.file}: ${e.message}`);}
    }
  }
  for(const [tag,w,h] of [['16x9',1920,1080],['9x16',1080,1920]]) {
    const shots=list.filter(x=>x.file.startsWith(`store/screenshots-${tag}/`));
    if(shots.length<3)errors.push(`only ${shots.length} ${tag} store screenshots`);
    for(const s of shots)if(s.width!==w||s.height!==h)errors.push(`wrong store shot size ${s.file}`);
  }
  const gs=JSON.parse(fs.readFileSync(path.join(__dirname,'gamesnacks-marketing.json')));
  for(const field of ['horizontalBanners','verticalBanners','screenshots','gameIcons','trailers']) {
    for(const asset of gs[field]) {
      const p=path.join(__dirname,asset.src);
      if(!fs.existsSync(p))errors.push(`GameSnacks ${field} source missing: ${asset.src}`);
      const recorded=list.find(x=>x.file===asset.src.slice(5));
      if(!recorded||recorded.width!==asset.size.width||recorded.height!==asset.size.height)
        errors.push(`GameSnacks ${field} size mismatch: ${asset.src}`);
    }
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname,'encoder.html')).href);
    for(const x of list.filter(x=>/\.(mp4|webm)$/.test(x.file))) {
      const src=pathToFileURL(path.join(dist,x.file)).href;
      try {
        const m=await page.evaluate(src=>new Promise((resolve,reject)=>{
          const v=document.createElement('video');v.preload='metadata';v.src=src;
          v.onloadedmetadata=()=>resolve({width:v.videoWidth,height:v.videoHeight,duration:v.duration});
          v.onerror=()=>reject(new Error(v.error?.message||'video load failed'));
          setTimeout(()=>reject(new Error('video metadata timeout')),15000);
        }),src);
        if(m.width!==x.width||m.height!==x.height)errors.push(`wrong video size ${x.file}`);
        if(Math.abs(m.duration-12)>.05)errors.push(`unexpected video duration ${x.file}: ${m.duration}`);
        if(x.file.endsWith('.mp4')){
          const timing=mp4Timing(path.join(dist,x.file));
          if(timing.samples!==360||Math.abs(timing.fps-30)>.001)errors.push(`wrong MP4 timing ${x.file}: ${JSON.stringify(timing)}`);
        }
        console.log(`${x.file}: ${m.width}x${m.height}, ${m.duration.toFixed(1)}s`);
      }catch(e){errors.push(`invalid video ${x.file}: ${e.message}`);}
    }
  }finally{await browser.close();}
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
  else console.log(`Verified ${list.length} assets, GameSnacks paths, 10 store screenshots, and 4 videos.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
