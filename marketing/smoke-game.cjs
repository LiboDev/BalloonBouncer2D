const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
function playwright(){try{return require('playwright')}catch{}const n=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');for(const x of fs.readdirSync(n)){const p=path.join(n,x,'node_modules','playwright');if(fs.existsSync(p))return require(p)}throw Error('Playwright missing')}
(async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const url=pathToFileURL(path.resolve(__dirname,'..','index.html')).href;
    const page=await browser.newPage({viewport:{width:360,height:640}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.waitForTimeout(250);
    await page.locator('#btn-play').click();
    if(!await page.locator('#overlay-title').evaluate(x=>x.classList.contains('hidden')))throw Error('Play did not start');
    await page.evaluate(()=>document.activeElement?.blur());
    await page.keyboard.press('Space');
    if(!await page.locator('#hint').evaluate(x=>x.classList.contains('hidden')))throw Error('Launch did not start');
    if(errors.length)throw Error(errors.join('\n'));
    await page.close();
    const yt=await browser.newPage();
    await yt.addInitScript(()=>{window.ytgame={IN_PLAYABLES_ENV:true,game:{loadData:async()=>null,saveData:async()=>{},firstFrameReady(){},gameReady(){}},system:{isAudioEnabled:()=>true,onAudioEnabledChange(){},onPause(){},onResume(){}},engagement:{sendScore:async()=>{}}}});
    await yt.goto(url+'?debug&capture&dpr=4'); await yt.waitForTimeout(250);
    if(await yt.evaluate(()=>!!window.__game))throw Error('Debug controls leaked into Playables');
    console.log('Normal Play/launch works; no page errors; capture hooks are gated in Playables.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
