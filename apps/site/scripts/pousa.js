const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
const OUT='/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha';
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  const erros=[]; p.on('pageerror',e=>erros.push(e.message));
  await p.goto('http://localhost:3001',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,2200));
  const m = await p.evaluate(() => { const h=document.getElementById('heroi');
    const fim=h.offsetTop+h.offsetHeight-window.innerHeight;
    return { fim, percurso: document.documentElement.scrollHeight - window.innerHeight - fim }; });
  for (const frac of [0.38, 0.42, 0.44, 0.47, 0.52]) {
    await p.evaluate(v=>window.scrollTo(0,v), Math.round(m.fim + m.percurso*frac));
    await new Promise(r=>setTimeout(r,1500));
    const real = await p.evaluate(()=>window.scrollY);
    await p.screenshot({ path:`${OUT}/pousa-${frac}.png`, clip:{x:0,y:real,width:1440,height:900} });
    const d = await p.evaluate(() => {
      const mesa = document.querySelector('#mesa .mesa');
      if (!mesa) return 'mesa fora de vista';
      const r = mesa.getBoundingClientRect();
      return { centroMesa: [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)] };
    });
    console.log(`p=${frac}`, JSON.stringify(d));
  }
  console.log('erros:', erros.length?erros:'nenhum');
  await b.close();
})();
