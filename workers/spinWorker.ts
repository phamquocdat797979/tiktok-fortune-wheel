import { prisma } from '../lib/prisma';
import { shiftMockQueue } from '../lib/queue';
import { Server } from 'socket.io';
import { EventEmitter } from 'events';
import { DonorData } from '../lib/types';
import { SLOTS } from '../lib/slotsData';
import { calculateAstrology } from '../lib/astrology';
import { generateFortuneText } from '../lib/llm';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

const CUNG_MAP: Record<string, string> = {
  'Bạch Dương': 'bach_duong', 'Kim Ngưu': 'kim_nguu', 'Song Tử': 'song_tu', 
  'Cự Giải': 'cu_giai', 'Sư Tử': 'su_tu', 'Xử Nữ': 'xu_nu', 'Thiên Bình': 'thien_binh', 
  'Bọ Cạp': 'bo_cap', 'Hổ Cáp': 'bo_cap', 'Nhân Mã': 'nhan_ma', 'Ma Kết': 'ma_ket', 
  'Bảo Bình': 'bao_binh', 'Song Ngư': 'song_ngu'
};

const CON_GIAP_MAP: Record<string, string> = {
  'Tý': 'ty', 'Sửu': 'suu', 'Dần': 'dan', 'Mão': 'mao', 'Thìn': 'thin', 
  'Tỵ': 'ty_2', 'Tị': 'ty_2', 'Ngọ': 'ngo', 'Mùi': 'mui', 'Thân': 'than', 
  'Dậu': 'dau', 'Tuất': 'tuat', 'Hợi': 'hoi'
};

/**
 * Phân nhánh Wiki theo thông tin người xem bình luận:
 *  - Đủ ngày/tháng/năm  → cung (daily_wiki) + tuoi (daily_wiki) + cả 2 static
 *  - Chỉ ngày + tháng   → chỉ cung (daily_wiki) + static zodiac   [conGiap = undefined]
 *  - Chỉ năm hoặc tháng/năm → chỉ tuoi (daily_wiki) + static canchi  [cungHoangDao = undefined]
 * Logic hoạt động tự nhiên vì astrology.ts chỉ set cungHoangDao khi có ngày+tháng,
 * và chỉ set conGiap khi có năm sinh.
 */
function readDailyWiki(astroData: any): string {
    let context = '';
    const wikiDir = path.join(process.cwd(), 'data', 'daily_wiki');
    const staticDir = path.join(process.cwd(), 'data', 'static_wiki');
    let foundCung = false;
    let foundTuoi = false;

    // === CUNG: chỉ đọc khi người dùng bình luận có ngày+tháng ===
    if (astroData.cungHoangDao && CUNG_MAP[astroData.cungHoangDao]) {
        try {
            const file = path.join(wikiDir, 'cung', `${CUNG_MAP[astroData.cungHoangDao]}.md`);
            if (fs.existsSync(file)) {
                context += "[TỬ VI CUNG HOÀNG ĐẠO HÔM NAY]\n" + fs.readFileSync(file, 'utf8') + "\n\n";
                foundCung = true;
            }
        } catch (e) {}

        // Static zodiac chỉ kèm theo khi có cung
        try {
            const zodiacFile = path.join(staticDir, 'zodiac_dict.json');
            const zodiacData = fs.existsSync(zodiacFile) ? JSON.parse(fs.readFileSync(zodiacFile, 'utf8')) : null;
            if (zodiacData && zodiacData[astroData.cungHoangDao]) {
                const entry = zodiacData[astroData.cungHoangDao];
                context += `[ĐẶC TÍNH CUNG ${astroData.cungHoangDao.toUpperCase()}]\n${typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2)}\n\n`;
            }
        } catch (e) {}
    }

    // === TUOI: chỉ đọc khi người dùng bình luận có năm sinh ===
    if (astroData.conGiap && CON_GIAP_MAP[astroData.conGiap]) {
        try {
            const file = path.join(wikiDir, 'tuoi', `${CON_GIAP_MAP[astroData.conGiap]}.md`);
            if (fs.existsSync(file)) {
                context += "[TỬ VI CON GIÁP HÔM NAY]\n" + fs.readFileSync(file, 'utf8') + "\n\n";
                foundTuoi = true;
            }
        } catch (e) {}

        // Static canchi chỉ kèm theo khi có tuổi
        try {
            const canchiFile = path.join(staticDir, 'canchi_dict.json');
            const canchiData = fs.existsSync(canchiFile) ? JSON.parse(fs.readFileSync(canchiFile, 'utf8')) : null;
            if (canchiData && astroData.canChi && canchiData[astroData.canChi]) {
                const entry = canchiData[astroData.canChi];
                context += `[ĐẶC TÍNH TUỔI ${astroData.canChi.toUpperCase()}]\n${typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2)}\n\n`;
            }
        } catch (e) {}
    }

    // Log rõ chế độ đang chạy để dễ giám sát
    const mode = foundCung && foundTuoi ? 'ĐẦY ĐỦ (ngày+tháng+năm)'
               : foundCung              ? 'CHỈ CUNG (ngày+tháng)'
               : foundTuoi             ? 'CHỈ TUỔI (năm sinh)'
               : 'KHÔNG CÓ WIKI';
    if (!foundCung && !foundTuoi) {
        console.warn(`⚠️ RAG [${mode}]: cung="${astroData.cungHoangDao}" tuoi="${astroData.conGiap}" → Gemini sẽ phán chung chung!`);
    } else {
        console.log(`✅ RAG [${mode}]: cung="${astroData.cungHoangDao}" tuoi="${astroData.conGiap}"`);
    }

    return context.trim();
}

// Hàm gọi thẳng URL Google TTS và trả về base64 MP3
function fetchGoogleTTS(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob&ttsspeed=0.9`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        https.get(res.headers.location!, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          const chunks: Buffer[] = [];
          res2.on('data', (d: Buffer) => chunks.push(d));
          res2.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('TTS timeout')); });
  });
}

export const globalEventBus = new EventEmitter();

let isProcessing = false;

export function startSpinWorker(io: Server) {
  globalEventBus.on('new_mock_job', async () => {
     if (isProcessing) return; 
     
     while(true) {
        const data = shiftMockQueue();
        if (!data) break;
        
        isProcessing = true;
        const jobId = `job-${Date.now()}`;
        
        // --- BUỘC 1: TÍNH TOÁN DATA TỪ NGÀY SINH ---
        const astroData = calculateAstrology(data.dobString || "");
        
        // --- BƯỚC 2: TÍNH TOÁN VỊ TRÍ KIM CHỈ CỦA VÒNG QUAY ---
        let targetIndex = 0; // Mặc định là ô số 1
        
        // Ưu tiên dừng ở ô có Con Giáp, nếu không có Con Giáp thì tìm Cung Hoàng Đạo
        if (astroData.conGiap) {
          const idx = SLOTS.findIndex(s => s.conGiap === astroData.conGiap);
          if (idx !== -1) targetIndex = idx;
        } else if (astroData.cungHoangDao) {
          const idx = SLOTS.findIndex(s => s.cungHoangDao === astroData.cungHoangDao);
          if (idx !== -1) targetIndex = idx;
        }

        // --- BƯỚC 3: TRIGGER VÒNG QUAY NGAY LẬP TỨC (Zero Timeout) ---
        // Gửi tín hiệu animation ngay để Không Gây Delay
        io.emit('start_spin', { 
            ...data, 
            targetIndex, 
            jobId,
            astrologyData: astroData 
        });

        // --- BƯỚC 4: RAG - ĐỌC DAILY WIKI & GỌI GEMINI API CHẠY NGẦM ---
        const dailyContext = readDailyWiki(astroData);
        const fortuneTextPromise = generateFortuneText(astroData, data.nickname || 'bạn', dailyContext);

        // Lưu log lịch sử bói vào Prisma database (chạy bất đồng bộ)
        prisma.giftRecord.create({
          data: {
             viewer: {
                connectOrCreate: {
                   where: { tiktokId: data.userId },
                   create: {
                      tiktokId: data.userId,
                      uniqueId: data.uniqueId,
                      nickname: data.nickname,
                      dailyCoinCount: data.diamondCount || 0
                   }
                }
             },
             giftName: `Donate: ${data.diamondCount}`,
             diamondCount: data.diamondCount || 0,
             tier: 'Đồng' // Fallback for DB schema if required
          }
        }).catch(err => console.error("Prisma error:", err));

        // --- BƯỚC 5: ĐỢI API VÀ VÒNG QUAY XONG ---
        // Đợi Gemini nhả chữ ra (nếu Gemini failed thì nó trả về đoạn text dự phòng)
        const fortuneText = await fortuneTextPromise;

        // Phát text lên cho UI hiển thị và Control Panel đọc TTS
        io.emit('deliver_fortune_text', { jobId, fortuneText, donor: data });

        // Chờ Frontend xác nhận đã đọc xong chữ (Hoặc cho circuitbreaker 30s)
        await new Promise<void>((resolve) => {
          const onSpinComplete = (payload: any) => {
            if (payload.jobId === jobId) {
              globalEventBus.removeListener('spin_completed', onSpinComplete);
              clearTimeout(circuitBreaker);
              resolve();
            }
          };
          
          globalEventBus.on('spin_completed', onSpinComplete);
          
          const circuitBreaker = setTimeout(() => {
            globalEventBus.removeListener('spin_completed', onSpinComplete);
            console.warn(`⏳ Job timeout for ${jobId} - skipped to prevent queue blocking`);
            resolve();
          }, 35000); // Popup chừng 25s, thêm 10s dự trù 
        });
     }
     isProcessing = false;
  });

  return { name: "SpinWorker_Active" };
}
