const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3210', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  const r = await p.evaluate(() => {
    const H = window.innerHeight;
    const heroi = document.getElementById('heroi');
    const fim = heroi.offsetTop + heroi.offsetHeight - H;
    const total = document.documentElement.scrollHeight - H;
    const percurso = total - fim;
    const secoes = [...document.querySelectorAll('main > section, main > footer')].map(el => {
      const topo = el.offsetTop, alt = el.offsetHeight;
      const centro = topo + alt / 2 - H / 2;
      return {
        id: el.id || el.tagName.toLowerCase(),
        topo, altura: alt,
        fracaoDe: +(Math.max(0,(topo - fim)) / percurso).toFixed(3),
        fracaoCentro: +((centro - fim) / percurso).toFixed(3),
        fracaoAte: +((topo + alt - H - fim) / percurso).toFixed(3),
      };
    });
    return { alturaPagina: document.documentElement.scrollHeight, fimHeroi: fim, percurso, secoes };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
