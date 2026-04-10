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
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  
  try {
      const res = await fetch(url + '?t=' + Date.now().toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.text();
  } finally {
      clearTimeout(id);
  }
}

function cleanTextString(txt: string) {
    let cleantxt = txt.replace(/\(adsbygoogle=window\.adsbygoogle\|\|\[\]\)\.push\(\{\}\);/g, '')
                      .replace(/arfAsync\.push\([^)]+\);/g, '');
                      
    // Xóa rác mạng xã hội và các dòng không cần thiết ở cuối bài
    cleantxt = cleantxt.replace(/\d+\s*Thích\s*Trả lời\s*Chia sẻ/gi, '')
                       .replace(/Thích\s*Trả lời\s*Chia sẻ/gi, '')
                       .replace(/^Xem thêm:.*$/gim, '')
                       .replace(/^III\. Video.*$/gim, '')
                       .replace(/Hổ Cáp/g, 'Bọ Cạp');
                       
    // Tách các đoạn tử vi từng tuổi dính liền nhau (nếu trang gốc viết dính)
    cleantxt = cleantxt.replace(/([.:!?])\s*(Tử vi tuổi)/g, '$1\n- $2');
                       
    // Xóa các ký tự Tab, canh chỉnh lại từng dòng
    cleantxt = cleantxt.split('\n')
                       .map(line => line.trim().replace(/\s+/g, ' ').replace(/^-$/, ''))
                       .filter(line => line.length > 0)
                       .join('\n\n');
                       
    // Trang trí chuẩn Markdown cho các đề mục
    cleantxt = cleantxt.replace(/(Sự nghiệp:|Tài lộc:|Tài chính:|Sức khỏe:|Tình cảm:|Giờ tốt:|Màu sắc cát tường:|Quý nhân phù trợ:|Các chỉ số trong ngày:)/g, '\n- **$1** ')
                       .replace(/\n\n\n/g, '\n\n')
                       .replace(/\n\n- \*\*/g, '\n- **')
                       .replace(/\n-\s*\n- \*\*/g, '\n- **');
                       
    return cleantxt.replace(/\n{3,}/g, '\n\n').trim();
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
            // Loại bỏ hoàn toàn dòng cuối cùng nếu là tiêu đề bị dính sang file khác
            sectionText = sectionText.replace(/\d+\.\s*Tử vi ngày.*?$/gi, '').trim();
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
  // Thay thế block tags và br bằng newline để cheerio tách dòng chính xác
  const html = htmlRaw.replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<\/(p|div|h1|h2|h3|h4|li|td|th|ul)>/gi, '\n');
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  // Xóa rác HTML
  $('script, style, noscript, iframe, nav, header, footer').remove();
  
  const text = cleanTextString($('body').text());
  cleanDir(CUNG_DIR);
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
  // Thay thế block tags và br bằng newline để cheerio tách dòng chính xác
  const html = htmlRaw.replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<\/(p|div|h1|h2|h3|h4|li|td|th|ul)>/gi, '\n');
  const $ = cheerio.select ? cheerio.load(html) : (cheerio as any).load(html);
  
  $('script, style, noscript, iframe, nav, header, footer').remove();
  
  const text = cleanTextString($('body').text());
  cleanDir(TUOI_DIR);
  extractSections(text, TUOI_NAMES, TUOI_DIR, true);
}

export async function runDailyScraper() {
  console.log('Bắt đầu tải Dữ liệu Tử Vi Hôm Nay (Daily Wiki)...');
  
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
