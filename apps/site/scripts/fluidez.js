const puppeteer = require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });

  async function medir(comLenis) {
    const p = await b.newPage();
    await p.setViewport({width:1440,height:900});
    if (!comLenis) {
      // desliga o Lenis antes de ele montar
      await p.evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'matchMedia', { value: (q) =>
          ({ matches: q.includes('reduce'), media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }) });
      });
    }
    await p.goto('http://localhost:3210',{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,2000));
    await p.evaluate(() => {
      window.__amostras = [];
      let ant = window.scrollY, t0 = performance.now();
      const passo = (t) => {
        const y = window.scrollY;
        window.__amostras.push({ dy: y - ant, dt: t - t0 });
        ant = y; t0 = t;
        requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
    // seis entalhes de roda, como uma pessoa rolando
    for (let i=0;i<6;i++) { await p.mouse.wheel({ deltaY: 120 }); await new Promise(r=>setTimeout(r,120)); }
    await new Promise(r=>setTimeout(r,1400));
    const a = await p.evaluate(() => window.__amostras.filter(s => s.dy !== 0));
    await p.close();
    if (!a.length) return { quadros:0 };
    const dys = a.map(s=>s.dy);
    const media = dys.reduce((x,y)=>x+y,0)/dys.length;
    const dp = Math.sqrt(dys.reduce((s,v)=>s+(v-media)**2,0)/dys.length);
    return { quadros: a.length, maiorSalto: Math.max(...dys), passoMedio: +media.toFixed(1), desvio: +dp.toFixed(1) };
  }

  console.log('sem Lenis :', JSON.stringify(await medir(false)));
  console.log('com Lenis :', JSON.stringify(await medir(true)));
  await b.close();
})();
