// Encode every fixed-timestep browser frame to MP4/WebM with Chrome WebCodecs,
// plus a short indexed GIF. The video has no external media or licensing needs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const cfg = require('./promo.config.json');
const mux = require('./video-mux.cjs');
const root = path.resolve(__dirname, '..');
const target = path.join(__dirname, 'encoded-previews');
fs.mkdirSync(target, { recursive: true });

function cachedPackage(name) {
  try { return require(name); } catch {}
  const base = path.join(os.homedir(),'AppData','Local','npm-cache','_npx');
  for (const entry of fs.readdirSync(base)) {
    const p=path.join(base,entry,'node_modules',name);
    if (fs.existsSync(p)) return require(p);
  }
  throw Error(`Missing ${name}`);
}
const { chromium } = cachedPackage('playwright');
const sharp = cachedPackage('sharp');
function site() {
  return http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+rel);
    if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file,(err,data)=>{
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200,{'Content-Type':path.extname(file)==='.png'?'image/png':'text/html'});
      res.end(data);
    });
  });
}
async function record(page,base,name,width,height,format,fps) {
  const frameDir=path.join(__dirname,'preview',`frames-${name}`);
  const frames=fs.readdirSync(frameDir).filter(x=>x.endsWith('.png')).sort();
  const urls=frames.map(f=>`${base}/marketing/preview/frames-${name}/${f}`);
  const encoded=await page.evaluate(async({urls,width,height,format,fps})=>{
    const config={codec:format==='mp4'?'avc1.420028':'vp09.00.10.08',width,height,
      bitrate:format==='mp4'?6000000:3000000,framerate:fps,latencyMode:'realtime'};
    if(format==='mp4')config.avc={format:'avc'};
    if(!(await VideoEncoder.isConfigSupported(config)).supported)throw Error('Unsupported video configuration');
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=16383)s+=btoa(String.fromCharCode(...bytes.subarray(i,i+16383)));return s;}
    const chunks=[];let description=null,failed=null;
    const encoder=new VideoEncoder({
      output(chunk,metadata){
        const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);
        chunks.push({data:b64(bytes),timestamp:chunk.timestamp,key:chunk.type==='key'});
        if(metadata.decoderConfig?.description)description=b64(new Uint8Array(metadata.decoderConfig.description));
      },error(e){failed=e.message}
    });
    encoder.configure(config);
    const pending=new Map();
    const load=n=>{if(n<urls.length&&!pending.has(n))pending.set(n,(async()=>{const image=new Image();image.src=urls[n];await image.decode();return image})());};
    for(let n=0;n<4;n++)load(n);
    for(let n=0;n<urls.length;n++) {
      const img=await pending.get(n);pending.delete(n);load(n+4);
      ctx.drawImage(img,0,0,width,height);
      const frame=new VideoFrame(canvas,{timestamp:Math.round(n*1e6/fps),duration:Math.round((n+1)*1e6/fps)-Math.round(n*1e6/fps)});
      encoder.encode(frame,{keyFrame:n%(fps*3)===0});frame.close();
      if(encoder.encodeQueueSize>8)await new Promise(r=>{encoder.ondequeue=()=>{if(encoder.encodeQueueSize<=8){encoder.ondequeue=null;r()}}});
      if(failed)throw Error(failed);
    }
    await encoder.flush();encoder.close();
    if(failed)throw Error(failed);
    if(chunks.length!==urls.length)throw Error(`Encoded ${chunks.length} of ${urls.length} frames`);
    if(chunks.some((c,i)=>i&&c.timestamp<=chunks[i-1].timestamp))throw Error('Encoder reordered frames');
    return {chunks,description};
  },{urls,width,height,format,fps});
  const chunks=encoded.chunks.map(c=>({...c,data:Buffer.from(c.data,'base64')}));
  const data=format==='mp4'?mux.mp4(chunks,Buffer.from(encoded.description,'base64'),width,height,fps):mux.webm(chunks,width,height,fps);
  const rel=`gameplay-${name}-${width}x${height}.${format}`;
  fs.writeFileSync(path.join(target,rel),data);
  console.log(`${rel}: ${chunks.length} frames, ${fps} fps, ${Math.round(data.length/1024)} KiB`);
}

function u16(n) { const b=Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function gifLzw(indices) {
  const clear=256,end=257;
  let bit=0,acc=0;
  const bytes=[];
  function write(code) {
    acc|=code<<bit; bit+=9;
    while(bit>=8) { bytes.push(acc&255); acc>>>=8; bit-=8; }
  }
  // Clear every 200 literals, before a 9-bit code width change is required.
  // This trades GIF size for reliable decoding without an external encoder.
  for(let i=0;i<indices.length;i++) {
    if(i%200===0) write(clear);
    write(indices[i]);
  }
  write(end);
  if(bit)bytes.push(acc&255);
  const blocks=[];
  for(let i=0;i<bytes.length;i+=255)blocks.push(Buffer.from([Math.min(255,bytes.length-i)]),Buffer.from(bytes.slice(i,i+255)));
  blocks.push(Buffer.from([0]));
  return Buffer.concat([Buffer.from([8]),...blocks]);
}
async function gif(name,sourceWidth,sourceHeight,fps=30) {
  const wide=sourceWidth>sourceHeight;
  const width=wide?480:270, height=Math.round(width*sourceHeight/sourceWidth);
  const frameDir=path.join(__dirname,'preview',`frames-${name}`);
  const frames=fs.readdirSync(frameDir).filter(x=>x.endsWith('.png')).sort();
  const selected=frames.slice(Math.floor(frames.length/4),Math.floor(frames.length/4)+fps*6).filter((_,i)=>i%Math.round(fps/5)===0);
  const header=Buffer.concat([Buffer.from('GIF89a'),u16(width),u16(height),Buffer.from([0xf7,0,0])]);
  const palette=Buffer.alloc(768);
  for(let i=0;i<256;i++) {
    palette[i*3]=Math.round(((i>>5)&7)*255/7);
    palette[i*3+1]=Math.round(((i>>2)&7)*255/7);
    palette[i*3+2]=Math.round((i&3)*255/3);
  }
  const parts=[header,palette,Buffer.from([0x21,0xff,0x0b]),Buffer.from('NETSCAPE2.0'),Buffer.from([3,1,0,0,0])];
  for(const f of selected) {
    const rgb=await sharp(path.join(frameDir,f)).resize(width,height).removeAlpha().raw().toBuffer();
    const indexed=Buffer.alloc(width*height);
    for(let i=0,j=0;i<rgb.length;i+=3,j++)indexed[j]=((rgb[i]>>5)<<5)|((rgb[i+1]>>5)<<2)|(rgb[i+2]>>6);
    parts.push(Buffer.from([0x21,0xf9,4,4,20,0,0,0]));
    parts.push(Buffer.concat([Buffer.from([0x2c]),u16(0),u16(0),u16(width),u16(height),Buffer.from([0])]));
    parts.push(gifLzw(indexed));
  }
  parts.push(Buffer.from([0x3b]));
  const rel=`gameplay-${name}-${width}x${height}.gif`;
  fs.writeFileSync(path.join(target,rel),Buffer.concat(parts));
  console.log(`${rel}: ${selected.length} frames`);
}
async function main() {
  if(process.argv.includes('--gif-only')) {
    for(const pv of cfg.previews) await gif(pv.name,...pv.size,pv.fps);
    return;
  }
  const app=site(); await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    await page.goto(`${base}/marketing/encoder.html`);
    for(const pv of cfg.previews) {
      const [w,h]=pv.size;
      await record(page,base,pv.name,w,h,'mp4',pv.fps);
      await record(page,base,pv.name,w/2,h/2,'webm',pv.fps);
      await gif(pv.name,w,h,pv.fps);
    }
  } finally { await browser.close(); app.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
