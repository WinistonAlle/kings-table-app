const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
const OUT = '/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha';
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3210', { waitUntil: 'networkidle0' });
  await new Promise(r=>setTimeout(r,2500));
  const fim = await p.evaluate(() => { const e=document.getElementById('heroi'); return e.offsetTop+e.offsetHeight-window.innerHeight; });
  const passos = [];
  for (let d = -80; d <= 120; d += 8) passos.push(fim + d);
  const fs = require('fs');
  const linhas = [];
  for (const y of passos) {
    await p.evaluate(v => window.scrollTo(0, v), y);
    await new Promise(r=>setTimeout(r, 700));
    const real = await p.evaluate(()=>window.scrollY);
    const buf = await p.screenshot({ clip: { x: 300, y: real + 120, width: 840, height: 660 } });
    fs.writeFileSync(`${OUT}/pisc-${y - fim}.png`, buf);
    linhas.push(y - fim);
  }
  console.log(JSON.stringify(linhas));
  await b.close();
})();
