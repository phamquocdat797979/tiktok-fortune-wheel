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

function cleanTextString(txt: string) {
    return txt.replace(/\s+/g, ' ')
              .replace(/\(adsbygoogle=window\.adsbygoogle\|\|\[\]\)\.push\(\{\}\);/g, '')
              .replace(/arfAsync\.push\([^)]+\);/g, '')
              .replace(/([.:!?”\)★])([A-Z])/g, '$1 $2')
              // Xử lý riêng các block rác bị dính sát từ do HTML mất tag
              .replace(/(Sự nghiệp:|Tài lộc:|Sức khỏe:|Tình cảm:|Giờ tốt:|Màu sắc cát tường:|Quý nhân phù trợ:|Các chỉ số trong ngày:)/g, ' $1')
              .trim();
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
     
     // Bỏ qua các mục lục
     let endIdx = -1;
     while (startIdx !== -1) {
         let tempEnd = -1;
         if (next) {
             tempEnd = text.indexOf(anchorNext, startIdx + 10);
             if (tempEnd === -1) tempEnd = text.indexOf(next.name, startIdx + 10);
         }
         
         if (!next || (tempEnd !== -1 && (tempEnd - startIdx) > 100)) {
             if (next) {
                 endIdx = tempEnd;
             } else {
                 // Item cuối cùng: cắt rác footer bằng cách tìm marker xuất hiện sớm nhất
                 endIdx = text.length;
                 const markers = ['Bình luận', 'Mời các bạn', 'Mời bạn đọc', 'Tin cùng chuyên mục', 'Đọc nhiều', 'Tử vi các ngày khác', 'Thích trang'];
                 for (const m of markers) {
                     const mIdx = text.indexOf(m, startIdx + 50);
                     if (mIdx !== -1 && mIdx < endIdx) {
                         endIdx = mIdx;
                     }
                 }
                 // Dự phòng nếu ko tìm thấy các marker kia thì cắt adsbygoogle (nếu còn sót)
                 const adIdx = text.indexOf('(adsbygoogle', startIdx);
                 if (adIdx !== -1 && adIdx < endIdx) endIdx = adIdx;
             }
             break;
         }
         
         startIdx = text.indexOf(anchorCurrent, startIdx + 1);
         if (startIdx === -1) startIdx = text.indexOf(current.name, startIdx + 1);
     }
     
     if (startIdx !== -1 && endIdx > startIdx) {
         let sectionText = text.substring(startIdx, endIdx).trim();
         // Xóa đuôi rác như "2. Tử vi" hoặc "3. Tử vi tuổi"
         sectionText = sectionText.replace(/\d+\.\s*Tử vi\s*$/i, '')
                                  .replace(/\d+\.\s*Tử vi tuổi\s*$/i, '')
                                  .replace(/Tử vi thứ \d+ ngày.*?của 12 con giáp.*?$/gi, '')
                                  .trim();
                                  
         if (sectionText.length > 50) {
            fs.writeFileSync(path.join(dir, `${current.key}.md`), sectionText, 'utf8');
            searchOffset = endIdx; 
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
  const htmlRaw = await fetchHtml(url);
  // Add spaces to HTML blocks to prevent text gluing when Cheerio extracts text
  const html = htmlRaw.replace(/<\/(p|div|h1|h2|h3|h4|li|td|th)>/gi, ' </$1> ')
                      .replace(/<br\s*\/?>/gi, ' ');
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  // Xóa rác HTML
  $('script, style, noscript, iframe, nav, header, footer').remove();
  
  const text = cleanTextString($('body').text());
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
  const htmlRaw = await fetchHtml(targetUrl);
  // Add spaces to HTML blocks to prevent text gluing when Cheerio extracts text
  const html = htmlRaw.replace(/<\/(p|div|h1|h2|h3|h4|li|td|th)>/gi, ' </$1> ')
                      .replace(/<br\s*\/?>/gi, ' ');
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  $('script, style, noscript, iframe, nav, header, footer').remove();
  
  const text = cleanTextString($('body').text());
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
