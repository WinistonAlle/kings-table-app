const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto('http://localhost:3001',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,2500));
  const m = await p.evaluate(() => { const h=document.getElementById('heroi');
    const fim=h.offsetTop+h.offsetHeight-window.innerHeight;
    return { fim, percurso: document.documentElement.scrollHeight - window.innerHeight - fim }; });
  await p.evaluate(v=>window.scrollTo(0,v), Math.round(m.fim + m.percurso*0.20));
  await new Promise(r=>setTimeout(r,1400));
  console.log(JSON.stringify(await p.evaluate(() => {
    const a=document.querySelector('.anel-texto').getBoundingClientRect();
    const grade=document.querySelector('#como-funciona ol').getBoundingClientRect();
    const titulo=[...document.querySelectorAll('#como-funciona h2')][1].getBoundingClientRect();
    const rot=[...document.querySelectorAll('#como-funciona p')].find(e=>e.textContent.includes("Com o King"))?.getBoundingClientRect();
    return {
      anel: { topo: Math.round(a.top), base: Math.round(a.bottom), esq: Math.round(a.left), dir: Math.round(a.right) },
      grade_base: Math.round(grade.bottom),
      rotulo_topo: rot ? Math.round(rot.top) : null,
      titulo_topo: Math.round(titulo.top),
      folgaAcima: Math.round(a.top - grade.bottom),
      folgaAbaixo: rot ? Math.round(rot.top - a.bottom) : null,
    };
  }), null, 1));
  const y = await p.evaluate(()=>window.scrollY);
  await p.screenshot({ path:'/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha/faixa.png', clip:{x:0,y,width:1440,height:900} });
  await b.close();
})();
