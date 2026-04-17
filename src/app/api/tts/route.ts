import { NextResponse } from 'next/server';
import { getAudioBase64 } from 'google-tts-api';

// =============================================================
//  📋 DANH SÁCH GEMINI API KEYS (Xoay vòng tự động)
//  Điền 3 key từ 3 Gmail khác nhau vào file .env hoặc Railway:
//    GEMINI_API_KEY_1=AIzaSy...
//    GEMINI_API_KEY_2=AIzaSy...
//    GEMINI_API_KEY_3=AIzaSy...
// =============================================================
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

// Chỉ số key hiện tại (xoay vòng theo từng request)
let currentKeyIndex = 0;

// -------------------------------------------------------------
//  Gọi Gemini TTS với 1 key cụ thể
//  Model: gemini-2.5-flash-preview-tts (miễn phí cho Developer)
// -------------------------------------------------------------
async function callGeminiTTS(text: string, apiKey: string): Promise<string | null> {
  const model = 'gemini-2.5-flash-preview-tts';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } // Giọng nữ tự nhiên, phù hợp Tiếng Việt
          }
        }
      }
    }),
    // Timeout 20s vì văn bản tử vi dài
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err: any = new Error(`Gemini API HTTP ${res.status}`);
    err.statusCode = res.status;
    err.body = errBody;
    throw err;
  }

  const data = await res.json();
  // Gemini trả về audio dưới dạng base64 inline
  const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return audioBase64 ?? null;
}

// -------------------------------------------------------------
//  Xoay vòng qua tất cả Gemini keys
//  - Nếu key bị Rate Limit (429) → thử key kế tiếp
//  - Nếu tất cả keys đều thất bại → trả về null (kích hoạt Google Fallback)
// -------------------------------------------------------------
async function tryGeminiWithRotation(text: string): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) {
    console.warn('[Gemini TTS] Chưa cấu hình Gemini API Key nào, dùng Google Fallback.');
    return null;
  }

  const startIndex = currentKeyIndex;

  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const keyIndex = (startIndex + i) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[keyIndex];

    try {
      console.log(`[Gemini TTS] Đang dùng Key #${keyIndex + 1}...`);
      const result = await callGeminiTTS(text, key);

      // Thành công → cập nhật vị trí key để lần sau bắt đầu từ đây (tránh key 1 gánh hết)
      currentKeyIndex = (keyIndex + 1) % GEMINI_KEYS.length;
      console.log(`[Gemini TTS] ✅ Key #${keyIndex + 1} thành công.`);
      return result;

    } catch (err: any) {
      if (err?.statusCode === 429) {
        console.warn(`[Gemini TTS] ⚠️  Key #${keyIndex + 1} bị Rate Limit (429). Thử key tiếp theo...`);
        continue;
      }
      // Lỗi khác (500, network...) → vẫn thử key tiếp, ghi log lại
      console.error(`[Gemini TTS] ❌ Key #${keyIndex + 1} lỗi [${err?.statusCode ?? 'network'}]:`, err?.message);
      continue;
    }
  }

  console.warn('[Gemini TTS] Tất cả Keys đã thất bại. Chuyển sang Google Dự Phòng...');
  return null;
}

// -------------------------------------------------------------
//  DỰ PHÒNG: Google Translate TTS (không cần API Key)
//  Giọng robot, nhưng không bao giờ bị rate limit trong dự án nhỏ.
//  Mỗi chunk tối đa 180 ký tự (giới hạn của Google Dịch).
// -------------------------------------------------------------
async function useGoogleFallback(text: string): Promise<string[]> {
  const rawChunks = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const phrase of rawChunks) {
    if (current.length + phrase.length > 180) {
      if (current) chunks.push(current.trim());
      current = phrase;
    } else {
      current += ' ' + phrase;
    }
  }
  if (current) chunks.push(current.trim());

  const promises = chunks
    .filter(c => c.length > 0)
    .map(chunk =>
      getAudioBase64(chunk, {
        lang: 'vi',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      }).catch(err => {
        console.error('[Google TTS Fallback] Lỗi chunk:', err);
        return null;
      })
    );

  const results = await Promise.all(promises);
  return results.filter(Boolean) as string[];
}

// =============================================================
//  🚀 MAIN HANDLER
//  Thứ tự ưu tiên:
//    1. Gemini TTS (Key 1 → Key 2 → Key 3 xoay vòng)
//    2. Google Translate TTS (dự phòng cuối cùng)
// =============================================================
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    // --- Ưu tiên 1: Gemini TTS ---
    const geminiAudio = await tryGeminiWithRotation(text);

    if (geminiAudio) {
      // Gemini trả về 1 đoạn audio duy nhất cho toàn bộ văn bản (không cần chunk)
      return NextResponse.json({
        chunks: [{ base64: geminiAudio }],
        source: 'gemini',
      });
    }

    // --- Dự phòng: Google Translate TTS ---
    console.log('[TTS] Dùng Google Translate TTS dự phòng...');
    const fallbackChunks = await useGoogleFallback(text);

    return NextResponse.json({
      chunks: fallbackChunks.map(b => ({ base64: b })),
      source: 'google-fallback',
    });

  } catch (error: any) {
    console.error('[TTS] Lỗi server nghiêm trọng:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
