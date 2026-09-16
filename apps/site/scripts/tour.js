const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
const OUT='/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha';
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:900});
  const erros=[]; p.on('pageerror',e=>erros.push(e.message));
  await p.goto('http://localhost:3210',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,2200));
  const alvos = await p.evaluate(() => {
    const out=[];
    document.querySelectorAll('main > section').forEach((s,i) => out.push({ i, id:s.id||'s'+i, top:s.offsetTop }));
    return out;
  });
  for (const a of alvos) {
    await p.evaluate(y => window.scrollTo(0,y), a.top + 40);
    await new Promise(r=>setTimeout(r,1200));
    const y = await p.evaluate(()=>window.scrollY);
    await p.screenshot({ path:`${OUT}/t-${a.i}-${a.id}.png`, clip:{x:0,y,width:1440,height:900} });
  }
  console.log('seções:', alvos.map(a=>a.id).join(', '), erros.length?('ERROS '+erros):'sem erros');
  await b.close();
})();
