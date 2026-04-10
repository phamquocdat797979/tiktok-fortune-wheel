import * as cheerio from 'cheerio';

async function debugCung() {
  const url = 'https://lichngaytot.com/tu-vi-hang-ngay-11-04-2026.html';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
  const $ = cheerio.load(html);
  $('script, style, .adsbygoogle, iframe').remove();

  // Find h2 for Bach Duong, then its parent structure
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.includes('Bạch Dương')) return;
    
    // The entry div is the sibling of h2's parent
    const entry = $(el).next('.entry, div');
    console.log('Entry div found:', entry.length > 0, '| children:', entry.children().length);
    
    // Show all children of entry
    entry.children().each((i, child) => {
      const $c = $(child);
      const tag = child.name;
      const cls = $c.attr('class') || '';
      const txt = $c.text().trim().substring(0, 100);
      console.log(`[child ${i}] <${tag} class="${cls}"> text:"${txt}"`);
    });
  });
}

debugCung().catch(console.error);
