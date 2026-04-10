import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const TUOI_DIR = path.join(process.cwd(), 'data', 'daily_wiki', 'tuoi');
const TUOI_NAMES = [
  { name: 'Tý', key: 'ty' },
  { name: 'Sửu', key: 'suu' },
  { name: 'Dần', key: 'dan' },
  { name: 'Mão', key: 'mao' },
  { name: 'Thìn', key: 'thin' },
  { name: 'Tị', key: 'ty_2' },
  { name: 'Ngọ', key: 'ngo' },
  { name: 'Mùi', key: 'mui' },
  { name: 'Thân', key: 'than' },
  { name: 'Dậu', key: 'dau' },
  { name: 'Tuất', key: 'tuat' },
  { name: 'Hợi', key: 'hoi' }
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url + '?t=' + Date.now().toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.text();
}

/** Trích text sạch, xử lý danh sách dưới dạng bullet */
function nodeToMarkdown($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const $el = $(el);
  const text = $el.text().trim();
  if (!text) return '';
  if ($el.hasClass('adsbygoogle') || $el.hasClass('advbox2') || ($el.attr('class') || '').includes('adv') || ($el.attr('class') || '').includes('share')) return '';

  if (el.name === 'ul' || $el.find('li').length > 0) {
    const lines: string[] = [];
    $el.find('li').each((_, li) => {
      const t = $(li).text().trim();
      if (t) lines.push('- ' + t);
    });
    return lines.join('\n');
  }
  return text;
}

async function scrapeTuoi() {
  const indexUrl = `https://lichngaytot.com/boi-vui-12-con-giap-c277-p0.html`;
  const htmlIndex = await fetchHtml(indexUrl);
  const $index = cheerio.load(htmlIndex);
  const d = new Date();
  const dateSnippet = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  let targetUrl = '';

  $index('a').each((_, el) => {
    const txt = $index(el).text();
    const href = $index(el).attr('href');
    if (txt.includes('12 con giáp') && txt.includes(dateSnippet) && href) targetUrl = href;
  });

  if (!targetUrl) throw new Error('Không tìm thấy bài viết con giáp hôm nay!');
  if (!targetUrl.startsWith('http'))
    targetUrl = 'https://lichngaytot.com' + (!targetUrl.startsWith('/') ? '/' : '') + targetUrl;

  console.log(`[PURE-CODE] Đang cào 12 Giáp tại: ${targetUrl}`);
  const htmlRaw = await fetchHtml(targetUrl);
  const $ = cheerio.load(htmlRaw);
  $('script, style, .adsbygoogle, .jeg_share_button, iframe, .jeg_post_tags').remove();

  if (!fs.existsSync(TUOI_DIR)) fs.mkdirSync(TUOI_DIR, { recursive: true });

  // Xây dựng danh sách các "khối" con giáp, mỗi khối có h3 và điểm bắt đầu thu thập
  type GiapBlock = {
    name: string;
    h3El: cheerio.Element;
    wrapperEl: cheerio.Element; // div trực tiếp chứa h3 (hoặc bản thân h3 nếu nằm trong entry)
    entryEl: cheerio.Element;   // div.entry - container cấp cao nhất
  };

  const blocks: GiapBlock[] = [];

  $('h3').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.includes('tuổi')) return;

    const parent = $(el).parent(); // div wrapper hoặc div.entry
    const grandParent = parent.parent(); // div.entry hoặc cao hơn

    // Nếu parent có class "entry" => h3 nằm trực tiếp trong entry
    // Nếu không => h3 nằm trong div con, parent là wrapper
    const isDirectInEntry = (parent.attr('class') || '').includes('entry');
    const wrapperEl = isDirectInEntry ? el : parent[0];
    const entryEl = isDirectInEntry ? parent[0] : grandParent[0];

    blocks.push({ name: text, h3El: el, wrapperEl, entryEl });
  });

  console.log(`Tìm thấy ${blocks.length} con giáp.`);

  for (let i = 0; i < TUOI_NAMES.length; i++) {
    const item = TUOI_NAMES[i];
    console.log(`--- [CON GIÁP] ${item.name} ---`);

    const block = blocks.find(b => b.name.includes(`tuổi ${item.name}`));
    if (!block) { console.log(`  ⚠️ Không tìm thấy: ${item.name}`); continue; }

    const nextBlock = blocks[blocks.indexOf(block) + 1];
    const stopEl = nextBlock ? nextBlock.wrapperEl : null;

    let md = `### Tử vi ngày ${dateSnippet} tuổi ${item.name}\n\n`;

    // 1. Lấy nội dung BÊN TRONG wrapper (các children sau h3)
    if (block.wrapperEl !== block.h3El) {
      $(block.wrapperEl).children().each((_, child) => {
        if (child === block.h3El || child.name === 'br') return; // bỏ h3 tiêu đề và br
        const text = nodeToMarkdown($, child);
        if (text) md += text + '\n\n';
      });
    }

    // 2. Lấy các siblings của wrapper trong cùng div.entry
    let cursor = $(block.wrapperEl).next();
    while (cursor.length) {
      const el = cursor[0];
      if (stopEl && el === stopEl) break;
      if (el.name === 'h2' || el.name === 'h3') break;
      const text = cursor.text().trim();
      if (text.includes('Bình luận') || text.includes('III. Video') || text.includes('>>> Xem')) break;

      const extracted = nodeToMarkdown($, el);
      if (extracted) md += extracted + '\n\n';

      cursor = cursor.next();
    }

    const lineCount = md.split('\n').filter(l => l.trim()).length;
    if (lineCount > 3) {
      fs.writeFileSync(path.join(TUOI_DIR, `${item.key}.md`), md.trim(), 'utf8');
      console.log(`  ✓ Lưu ${item.key}.md (${lineCount} dòng)`);
    } else {
      console.log(`  ⚠️ Quá ngắn (${lineCount} dòng) cho: ${item.name}`);
    }
  }

  console.log(`\n✅ Hoàn tất 12 Con Giáp.`);
}

scrapeTuoi().catch(console.error);
