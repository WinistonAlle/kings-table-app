const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
const OUT='/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha';
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto('http://localhost:3210',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,2500));
  const s = await p.evaluate(() => { const e=document.getElementById('mesa'); return { topo:e.offsetTop, alt:e.offsetHeight }; });
  // 0.02 = a mesa acabou de entrar, a ficha ainda vem chegando
  // 0.55 = bem dentro da pausa
  for (const [nome,f] of [['antes',0.02],['durante',0.55]]) {
    await p.evaluate(v=>window.scrollTo(0,v), Math.round(s.topo + (s.alt-900)*f));
    await new Promise(r=>setTimeout(r,1600));
    const y = await p.evaluate(()=>window.scrollY);
    await p.screenshot({ path:`${OUT}/pouso-${nome}.png`, clip:{x:560,y:y+600,width:320,height:300} });
  }
  await b.close();
})();
