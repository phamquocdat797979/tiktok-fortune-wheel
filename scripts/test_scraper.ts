import * as cheerio from 'cheerio';

async function test() {
  const url = `https://lichngaytot.com/tu-vi-hang-ngay-10-04-2026.html`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url + '?t=' + Date.now().toString(), { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const htmlRaw = await res.text();
  
  const $ = cheerio.load(htmlRaw);
  $('script, style, noscript, iframe, .adsbygoogle').remove();
  
  const blocks: string[] = [];
  $('article .cat-box-content').find('p, h2, h3, h4, li').each((i, el) => {
      const text = $(el).text().trim();
      if (text) {
          blocks.push(text);
      }
  });

  const fullText = blocks.join('\n');
  console.log("Extracted text (first 1000 chars): \n", fullText.substring(0, 1000));
}

test();
