const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
const OUT='/private/tmp/claude-501/-Users-winistonalle/b55e52f7-f12c-43df-bc40-ac87bb5f41cc/scratchpad/ficha';

/* O Lenis intercepta `window.scrollTo`: pedir uma posição e fotografar em
   seguida devolve um quadro de OUTRO lugar da página. Aqui a rolagem é
   insistida até o `scrollY` real parar perto do alvo, e o valor obtido é
   impresso junto — medição que não confere onde parou não é medição. */
async function irAte(p, alvo) {
  for (let t = 0; t < 14; t++) {
    await p.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), alvo);
    await new Promise(r => setTimeout(r, 420));
    const y = await p.evaluate(() => Math.round(window.scrollY));
    if (Math.abs(y - alvo) < 8) { await new Promise(r=>setTimeout(r,700)); return y; }
  }
  return p.evaluate(() => Math.round(window.scrollY));
}

(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  const erros=[]; p.on('pageerror',e=>erros.push(e.message));
  await p.goto('http://localhost:3210',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,2500));
  const s = await p.evaluate(() => { const e=document.getElementById('mesa'); return { topo:e.offsetTop, alt:e.offsetHeight }; });
  console.log('dobra da mesa: topo', s.topo, 'altura', s.alt);
  for (const f of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const alvo = Math.round(s.topo + (s.alt - 900) * f);
    const real = await irAte(p, alvo);
    await p.screenshot({ path:`${OUT}/m3d-${f}.png`, clip:{x:0,y:real,width:1440,height:900} });
    const d = await p.evaluate(() => {
      const dd=[...document.querySelectorAll('#mesa dd')].map(e=>e.textContent.trim());
      return { nivel: dd[0], blinds: dd[1], dePe: dd[2] };
    });
    console.log(`f=${f} alvo ${alvo} real ${real}`, JSON.stringify(d));
  }
  console.log('erros:', erros.length?erros:'nenhum');
  await b.close();
})();
