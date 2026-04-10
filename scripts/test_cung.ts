import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function run() {
  const res = await fetch('https://lichngaytot.com/tu-vi-hang-ngay-10-04-2026.html');
  const html = await res.text();
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  const content = $('body').text().replace(/\s+/g, ' ');
  fs.writeFileSync('dump.txt', content, 'utf8');
}
run();
