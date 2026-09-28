const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
function playwright(){try{return require('playwright')}catch{}const n=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');for(const x of fs.readdirSync(n)){const p=path.join(n,x,'node_modules','playwright');if(fs.existsSync(p))return require(p)}throw Error('Playwright missing')}
(async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:1000}});
    await page.goto(pathToFileURL(path.join(__dirname,'encoder.html')).href);
    for(const [name,size] of [['landscape','1920x1080'],['portrait','1080x1920']]){
      const src=pathToFileURL(path.join(__dirname,'dist','previews',`gameplay-${name}-${size}.mp4`)).href;
      const [w,h]=size.split('x').map(Number);
      await page.setViewportSize({width:w,height:h});
      await page.evaluate(src=>{document.body.style.margin='0';document.body.innerHTML='<video style="width:100vw;height:100vh;object-fit:contain"></video>';document.querySelector('video').src=src},src);
      await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
      for(const t of [1,6,10]){
        await page.evaluate(t=>new Promise(r=>{const v=document.querySelector('video');v.onseeked=r;v.currentTime=t}),t);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await page.locator('video').screenshot({path:path.join(__dirname,'ref',`video-${name}-${t}s.png`)});
      }
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
