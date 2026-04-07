import { prisma } from '../lib/prisma';
import { shiftMockQueue } from '../lib/queue';
import { Server } from 'socket.io';
import { EventEmitter } from 'events';
import { DonorData } from '../lib/types';
import { SLOTS } from '../lib/slotsData';
import { calculateAstrology } from '../lib/astrology';
import { generateFortuneText } from '../lib/gemini';
import * as https from 'https';

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

        // --- BƯỚC 4: GỌI GEMINI API CHẠY NGẦM ---
        // Vòng quay chạy mất tầm 5-7 giây. Gemini thường mất 3-5 giây.
        const fortuneTextPromise = generateFortuneText(astroData, data.nickname || 'bạn');

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
