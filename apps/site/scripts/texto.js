const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:900});
  await p.goto('http://localhost:3210',{waitUntil:'networkidle0'});
  const r = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('main > section').forEach(s => {
      const t = (s.innerText||'').replace(/\s+/g,' ').trim();
      out.push({ id: s.id || '(sem id)', palavras: t.split(' ').filter(Boolean).length, chars: t.length });
    });
    const total = (document.querySelector('main').innerText||'').replace(/\s+/g,' ').trim();
    return { secoes: out, totalPalavras: total.split(' ').filter(Boolean).length };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
