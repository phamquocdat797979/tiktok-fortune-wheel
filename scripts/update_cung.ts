import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const CUNG_DIR = path.join(process.cwd(), 'data', 'daily_wiki', 'cung');
const CUNG_NAMES = [
  { name: 'Bạch Dương', key: 'bach_duong' },
  { name: 'Kim Ngưu', key: 'kim_nguu' },
  { name: 'Song Tử', key: 'song_tu' },
  { name: 'Cự Giải', key: 'cu_giai' },
  { name: 'Sư Tử', key: 'su_tu' },
  { name: 'Xử Nữ', key: 'xu_nu' },
  { name: 'Thiên Bình', key: 'thien_binh' },
  { name: 'Bọ Cạp', aliases: ['Bọ Cạp', 'Hổ Cáp', 'Thiên Yết', 'Thần Nông'], key: 'bo_cap' },
  { name: 'Nhân Mã', key: 'nhan_ma' },
  { name: 'Ma Kết', key: 'ma_ket' },
  { name: 'Bảo Bình', key: 'bao_binh' },
  { name: 'Song Ngư', key: 'song_ngu' }
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url + '?t=' + Date.now().toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.text();
}

export async function scrapeCung() {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const url = `https://lichngaytot.com/tu-vi-hang-ngay-${day}-${month}-${year}.html`;
  const dateStr = `${day}/${month}/${year}`;

  console.log(`[PURE-CODE] Đang cào 12 Cung tại: ${url}`);
  const htmlRaw = await fetchHtml(url);
  const $ = cheerio.load(htmlRaw);
  $('script, style, .adsbygoogle, iframe, .jeg_share_button, .jeg_post_tags').remove();

  if (!fs.existsSync(CUNG_DIR)) fs.mkdirSync(CUNG_DIR, { recursive: true });

  for (const item of CUNG_NAMES) {
    console.log(`--- [CUNG] ${item.name} ---`);
    const searchTerms = (item as any).aliases || [item.name];

    // Tìm thẻ h2 chứa tên cung
    let targetH2: cheerio.Cheerio<cheerio.Element> | null = null;
    $('h2').each((_, el) => {
      const h2Text = $(el).text().toUpperCase();
      if (searchTerms.some((t: string) => h2Text.includes(t.toUpperCase()))) {
        targetH2 = $(el);
        return false;
      }
    });

    if (!targetH2) {
      console.log(`  ⚠️ Không tìm thấy h2 cho: ${item.name}`);
      continue;
    }

    // Ngay sau h2 là div.entry chứa toàn bộ nội dung cung đó
    const entryDiv = (targetH2 as cheerio.Cheerio<cheerio.Element>).next('div');
    if (!entryDiv.length) {
      console.log(`  ⚠️ Không tìm thấy entry div cho: ${item.name}`);
      continue;
    }

    let md = `### Tử vi ngày ${dateStr} của ${item.name}\n\n`;

    // Duyệt từng children của entry div để lấy nội dung đúng định dạng
    entryDiv.children().each((_, child) => {
      const $child = $(child);
      const tag = child.name;
      const cls = $child.attr('class') || '';
      
      // Bỏ qua ảnh, quảng cáo, div trống
      if (cls.includes('imagecontainer') || cls.includes('adv') || cls.includes('share')) return;
      
      const text = $child.text().trim();
      if (!text) return;

      // Bỏ qua h3 tiêu đề ngày (ví dụ "Thứ 7 của Bạch Dương")
      if (tag === 'h3') return;

      // Nếu là danh sách li -> dùng bullet
      if ($child.find('li').length > 0) {
        $child.find('li').each((_, li) => {
          const t = $(li).text().trim();
          if (t) md += `- ${t}\n`;
        });
        md += '\n';
        return;
      }

      // Chuẩn hóa tên cung
      const cleanText = text
        .replace(/Hổ Cáp|Thiên Yết|Thần Nông/g, 'Bọ Cạp');

      md += cleanText + '\n\n';
    });

    const lineCount = md.split('\n').filter(l => l.trim()).length;
    if (lineCount > 3) {
      fs.writeFileSync(path.join(CUNG_DIR, `${item.key}.md`), md.trim(), 'utf8');
      console.log(`  ✓ Lưu ${item.key}.md (${lineCount} dòng)`);
    } else {
      console.log(`  ⚠️ Quá ngắn (${lineCount} dòng) cho: ${item.name}`);
    }
  }

  console.log(`\n✅ Hoàn tất 12 Cung Hoàng Đạo.`);
}

// Chạy trực tiếp khi dùng lệnh tsx
if (require.main === module) scrapeCung().catch(console.error);
