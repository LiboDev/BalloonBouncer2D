const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
function playwright(){try{return require('playwright')}catch{}const n=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');for(const x of fs.readdirSync(n)){const p=path.join(n,x,'node_modules','playwright');if(fs.existsSync(p))return require(p)}throw Error('Playwright missing')}
(async()=>{
  const b=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    for(const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]){
      await p.setViewportSize({width,height});await p.goto(pathToFileURL(path.join(__dirname,'gallery.html')).href);
      await p.waitForFunction(()=>[...document.images].every(x=>x.complete));
      const status=await p.evaluate(()=>({broken:[...document.images].filter(x=>!x.naturalWidth).map(x=>x.src),overflow:document.documentElement.scrollWidth>innerWidth}));
      if(status.broken.length||status.overflow)throw Error(JSON.stringify({name,...status}));
      await p.screenshot({path:path.join(__dirname,'ref',`gallery-${name}.png`),fullPage:true});
    }
    if(errors.length)throw Error(errors.join('\n'));
    console.log('Gallery checked on desktop and mobile: all images load; no horizontal overflow.');
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
