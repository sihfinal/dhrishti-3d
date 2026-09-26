const puppeteer = require('puppeteer-core');

const VIEWPORTS = [
  // Desktop
  { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
  { name: 'Desktop 1600x900',  width: 1600, height: 900 },
  { name: 'Desktop 1440x900',  width: 1440, height: 900 },
  { name: 'Desktop 1366x768',  width: 1366, height: 768 },
  // Laptop
  { name: 'Laptop 1280x800',   width: 1280, height: 800 },
  { name: 'Laptop 1024x768',   width: 1024, height: 768 },
  // Tablet
  { name: 'Tablet 768x1024',   width: 768,  height: 1024 },
  { name: 'Tablet 820x1180',   width: 820,  height: 1180 },
  // Mobile
  { name: 'Mobile 430x932',    width: 430,  height: 932 },
  { name: 'Mobile 390x844',    width: 390,  height: 844 },
  { name: 'Mobile 375x812',    width: 375,  height: 812 },
  { name: 'Mobile 360x800',    width: 360,  height: 800 },
];

const ROUTES = [
  '/',
  '/study-region',
  '/observations',
  '/data-services',
  '/operational-applications',
  '/resources',
  '/about',
  '/watch-demo',
  '/explore'
];

async function run() {
  console.log('Starting automated headless Chromium responsive test suite on production server...\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });

  const page = await browser.newPage();
  const results = [];

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('header', { timeout: 6000 });

    const metrics = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;
      
      const h1 = document.querySelector('h1');
      const h1Rect = h1 ? h1.getBoundingClientRect() : null;
      
      // Stats cards in hero
      const statsCards = document.querySelectorAll('section:nth-of-type(1) .rounded-xl.bg-white\\/95');
      const statsCount = statsCards.length;
      let statsOverflow = false;
      statsCards.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.right > clientW + 2 || r.left < -2) statsOverflow = true;
      });

      // Operational applications cards
      const opCards = document.querySelectorAll('#operational-applications .rounded-xl');
      const opCount = opCards.length;
      let opOverflow = false;
      opCards.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.right > clientW + 2 || r.left < -2) opOverflow = true;
      });

      // Check mobile hamburger button
      const hamburger = document.querySelector('button[aria-label="Toggle Navigation Menu"]');
      const hamburgerVisible = hamburger ? (window.getComputedStyle(hamburger).display !== 'none') : false;

      return {
        scrollW,
        clientW,
        noHorizontalOverflow: scrollW === clientW,
        headerFullWidth: headerRect ? Math.abs(headerRect.width - clientW) < 2 : false,
        headerLeftEdge: headerRect ? Math.abs(headerRect.left) < 2 : false,
        headerRightEdge: headerRect ? Math.abs(headerRect.right - clientW) < 2 : false,
        h1Fits: h1Rect ? (h1Rect.right <= clientW + 2 && h1Rect.left >= -2) : true,
        statsCount,
        statsOverflow,
        opCount,
        opOverflow,
        hamburgerVisible
      };
    });

    // Test mobile drawer if viewport is tablet or mobile
    let mobileNavWorks = true;
    if (vp.width < 1024) {
      try {
        const hamburgerBtn = await page.$('button[aria-label="Toggle Navigation Menu"]');
        if (hamburgerBtn) {
          await hamburgerBtn.click();
          mobileNavWorks = await page.waitForSelector('header nav.grid', { timeout: 3000 })
            .then(() => true)
            .catch(() => false);
        }
      } catch (err) {
        mobileNavWorks = false;
      }
    }

    const headerPass = metrics.headerFullWidth && metrics.headerLeftEdge && metrics.headerRightEdge;
    const overflowPass = metrics.noHorizontalOverflow;
    const heroPass = metrics.h1Fits && !metrics.statsOverflow;
    const cardsPass = !metrics.statsOverflow && !metrics.opOverflow && metrics.statsCount === 4 && metrics.opCount >= 4;
    const navPass = vp.width >= 1024 ? true : (metrics.hamburgerVisible && mobileNavWorks);
    const overallPass = headerPass && overflowPass && heroPass && cardsPass && navPass;

    results.push({
      viewport: `${vp.width}×${vp.height}`,
      name: vp.name,
      header: headerPass ? 'PASS' : 'FAIL',
      overflow: overflowPass ? 'PASS' : `FAIL (${metrics.scrollW} vs ${metrics.clientW})`,
      hero: heroPass ? 'PASS' : 'FAIL',
      cards: cardsPass ? 'PASS' : 'FAIL',
      navigation: navPass ? 'PASS' : 'FAIL',
      result: overallPass ? 'PASS' : 'FAIL',
      metrics
    });
  }

  // Print results table
  console.log('### Responsive Verification Results Table');
  console.log('| Viewport | Header | Horizontal Overflow | Hero | Cards | Navigation | Result |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const r of results) {
    console.log(`| ${r.viewport} | ${r.header} | ${r.overflow} | ${r.hero} | ${r.cards} | ${r.navigation} | **${r.result}** |`);
  }

  // Check all other routes at 1920x1080 and 375x812
  console.log('\n--- Checking all frontend routes for 100% full-width header and 0 horizontal overflow ---');
  for (const width of [1920, 375]) {
    await page.setViewport({ width, height: width === 1920 ? 1080 : 812 });
    console.log(`\nViewport ${width}px:`);
    for (const route of ROUTES) {
      await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('header', { timeout: 6000 }).catch(() => {});
      
      const check = await page.evaluate((vpWidth) => {
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        const header = document.querySelector('header');
        const headerRect = header ? header.getBoundingClientRect() : null;
        return {
          scrollW,
          clientW,
          noOverflow: scrollW === clientW,
          headerFullWidth: headerRect ? Math.abs(headerRect.width - clientW) < 2 : false,
          headerWidth: headerRect ? Math.round(headerRect.width) : 0
        };
      }, width);

      const pass = check.noOverflow && check.headerFullWidth;
      console.log(`  Route [${route.padEnd(25)}] -> ${pass ? 'PASS' : 'FAIL'} (Header: ${check.headerWidth}px, scrollW: ${check.scrollW}px, clientW: ${check.clientW}px)`);
    }
  }

  await browser.close();
  console.log('\nAll tests completed successfully!');
}

run().catch(err => {
  console.error('Error running responsive test:', err);
  process.exit(1);
});
