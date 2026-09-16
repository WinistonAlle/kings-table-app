const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
  });
  for (const [w,h] of [[390,844],[768,1024],[1440,900],[1920,1080]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    const erros = [];
    p.on('pageerror', e => erros.push(e.message));
    await p.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1800));
    const r = await p.evaluate(() => ({
      sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      telas: document.querySelectorAll('canvas').length,
      video: !!document.querySelector('video'),
      altura: document.documentElement.scrollHeight,
    }));
    console.log(`${w}x${h}`, JSON.stringify(r), erros.length ? 'ERROS: '+erros : '');
    await p.close();
  }
  await b.close();
})();
