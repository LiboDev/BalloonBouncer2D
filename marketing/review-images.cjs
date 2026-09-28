const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
function sharpModule(){try{return require('sharp')}catch{}const n=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');for(const x of fs.readdirSync(n)){const p=path.join(n,x,'node_modules','sharp');if(fs.existsSync(p))return require(p)}throw Error('Sharp missing')}
const sharp=sharpModule();
async function sheet(files,name,cols,w,h){
  const pad=12,label=30,rows=Math.ceil(files.length/cols),comps=[];
  for(let i=0;i<files.length;i++){
    const [file,title]=files[i];
    const thumb=await sharp(file).resize(w,h,{fit:'inside'}).png().toBuffer();
    const m=await sharp(thumb).metadata();
    const x=pad+(i%cols)*(w+pad),y=pad+Math.floor(i/cols)*(h+label+pad);
    comps.push({input:thumb,left:x+Math.round((w-m.width)/2),top:y+Math.round((h-m.height)/2)});
    const svg=`<svg width="${w}" height="${label}"><text x="4" y="20" fill="white" font-family="Arial" font-size="13">${title.replaceAll('&','&amp;')}</text></svg>`;
    comps.push({input:Buffer.from(svg),left:x,top:y+h});
  }
  await sharp({create:{width:cols*(w+pad)+pad,height:rows*(h+label+pad)+pad,channels:3,background:'#192344'}}).composite(comps).jpeg({quality:88}).toFile(path.join(__dirname,'ref',name));
}
(async()=>{
  const shots=path.join(__dirname,'screenshots'),captures=[];
  for(const device of fs.readdirSync(shots))for(const file of fs.readdirSync(path.join(shots,device)).filter(x=>x.endsWith('.png')))
    captures.push([path.join(shots,device,file),`${device} ${file.slice(0,2)}`]);
  await sheet(captures,'all-captures.jpg',10,240,200);
  const covers=path.join(__dirname,'dist','cover-art'),art=[];
  for(const kind of ['clean','with-logo'])for(const file of fs.readdirSync(path.join(covers,kind)))art.push([path.join(covers,kind,file),`${kind} ${file.replace('.jpg','')}`]);
  await sheet(art,'all-cover-variants.jpg',4,380,240);
  console.log('Reviewed sheet sources: 70 screenshots, 32 cover variants.');
})().catch(e=>{console.error(e);process.exitCode=1});
