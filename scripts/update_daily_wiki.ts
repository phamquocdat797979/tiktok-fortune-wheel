import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const DAILY_WIKI_DIR = path.join(process.cwd(), 'data', 'daily_wiki');
const CUNG_DIR = path.join(DAILY_WIKI_DIR, 'cung');
const TUOI_DIR = path.join(DAILY_WIKI_DIR, 'tuoi');

// Mảng theo đúng thứ tự xuất hiện trong bài viết
const CUNG_NAMES = [
  { name: 'Bạch Dương', key: 'bach_duong' },
  { name: 'Kim Ngưu', key: 'kim_nguu' },
  { name: 'Song Tử', key: 'song_tu' },
  { name: 'Cự Giải', key: 'cu_giai' },
  { name: 'Sư Tử', key: 'su_tu' },
  { name: 'Xử Nữ', key: 'xu_nu' },
  { name: 'Thiên Bình', key: 'thien_binh' },
  { name: 'Hổ Cáp', key: 'bo_cap' },
  { name: 'Nhân Mã', key: 'nhan_ma' },
  { name: 'Ma Kết', key: 'ma_ket' },
  { name: 'Bảo Bình', key: 'bao_binh' },
  { name: 'Song Ngư', key: 'song_ngu' }
];

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

function cleanDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url + '?t=' + Date.now().toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.text();
}

function extractSections(text: string, arr: {name: string, key: string}[], dir: string, isGiap: boolean) {
   let searchOffset = 0;
   
   for (let i = 0; i < arr.length; i++) {
     const current = arr[i];
     const next = arr[i + 1];
     
     // Từ khóa nhận diện đầu mục
     let anchorCurrent = isGiap ? `tuổi ${current.name}` : `${current.name} (`;
     let anchorNext = next ? (isGiap ? `tuổi ${next.name}` : `${next.name} (`) : '';
     
     // Tìm vị trí bắt đầu
     let startIdx = text.indexOf(anchorCurrent, searchOffset);
     if (startIdx === -1) {
         startIdx = text.indexOf(current.name, searchOffset);
     }
     
     // Bỏ qua các mục lục (Menu/Navigation) bằng cách kiểm tra khoảng cách tới mục tiếp theo
     let endIdx = -1;
     while (startIdx !== -1) {
         let tempEnd = -1;
         if (next) {
             tempEnd = text.indexOf(anchorNext, startIdx + 10);
             if (tempEnd === -1) tempEnd = text.indexOf(next.name, startIdx + 10);
         }
         
         // Nếu là mục cuối hoặc khoảng cách giữa 2 mục lớn hơn 100 ký tự thì đây chính là bài viết thật
         if (!next || (tempEnd !== -1 && (tempEnd - startIdx) > 100)) {
             endIdx = next ? tempEnd : text.indexOf('(adsbygoogle', startIdx);
             if (endIdx === -1 && !next) endIdx = text.length; // Fallback cho giáp cuối
             break;
         }
         
         // Nếu không, tìm kết quả `anchorCurrent` ở đoạn tiếp theo
         startIdx = text.indexOf(anchorCurrent, startIdx + 1);
         if (startIdx === -1) startIdx = text.indexOf(current.name, startIdx + 1);
     }
     
     if (startIdx !== -1 && endIdx > startIdx) {
         let sectionText = text.substring(startIdx, endIdx).trim();
         if (sectionText.length > 50) {
            fs.writeFileSync(path.join(dir, `${current.key}.md`), sectionText, 'utf8');
            searchOffset = endIdx; // Đẩy offset tới phần tiếp theo
         }
     }
   }
}

async function scrapeCungDaily() {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const url = `https://lichngaytot.com/tu-vi-hang-ngay-${day}-${month}-${year}.html`;
  
  console.log(`Tiến hành cào 12 Cung tại: ${url}`);
  const html = await fetchHtml(url);
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  const text = $('body').text().replace(/\s+/g, ' ');
  extractSections(text, CUNG_NAMES, CUNG_DIR, false);
}

async function scrapeTuoiDaily() {
  const d = new Date();
  const indexUrl = `https://lichngaytot.com/boi-vui-12-con-giap-c277-p0.html`;
  const htmlIndex = await fetchHtml(indexUrl);
  const $index = cheerio.select ? cheerio.load(htmlIndex) : (cheerio as any).load(htmlIndex);
  
  const expectedDateSnippet = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; 
  let targetUrl = '';
  
  $index('a').each((i, el) => {
    const txt = $index(el).text();
    const href = $index(el).attr('href');
    if (txt.includes('12 con giáp') && txt.includes(expectedDateSnippet) && href) {
        targetUrl = href;
    }
  });

  if (!targetUrl) throw new Error('Không tìm thấy bài viết tử vi con giáp hôm nay!');
  if (!targetUrl.startsWith('http')) targetUrl = 'https://lichngaytot.com' + (!targetUrl.startsWith('/') ? '/' : '') + targetUrl;

  console.log(`Tiến hành cào 12 Giáp tại: ${targetUrl}`);
  const html = await fetchHtml(targetUrl);
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  const text = $('body').text().replace(/\s+/g, ' ');
  extractSections(text, TUOI_NAMES, TUOI_DIR, true);
}

export async function runDailyScraper() {
  console.log('Bắt đầu tải Dữ liệu Tử Vi Hôm Nay (Daily Wiki)...');
  cleanDir(CUNG_DIR);
  cleanDir(TUOI_DIR);
  
  try {
     await scrapeCungDaily();
     console.log('✅ Cào xong 12 Cung Hoàng Đạo');
  } catch (err) {
     console.error('Lỗi khi cào Cung Hoàng Đạo:', err);
  }

  try {
     await scrapeTuoiDaily();
     console.log('✅ Cào xong 12 Con Giáp');
  } catch (err) {
     console.error('Lỗi khi cào Cung Con Giáp:', err);
  }
}

if (require.main === module) {
  runDailyScraper().then(() => console.log('HOÀN TẤT DAILY SCRAPER!'));
}
