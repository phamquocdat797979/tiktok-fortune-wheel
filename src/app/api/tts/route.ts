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

// Tên model Gemini TTS — thử lần lượt nếu model mới không tồn tại
const GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.0-flash-exp',  // fallback model name
];

// Kiểu trả về của hàm Gemini TTS
interface GeminiAudio {
  base64: string;
  mimeType: string; // Lấy thực tế từ API (audio/wav, audio/pcm...)
}

// -------------------------------------------------------------
//  Chuyển dữ liệu PCM thô (audio/L16) sang file WAV có header
//  Trình duyệt không thể phát PCM thẩng, phải bọc WAV bên ngoài.
// -------------------------------------------------------------
function pcmToWav(pcmBase64: string, sampleRate: number, numChannels = 1, bitsPerSample = 16): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const dataLength = pcmBuffer.length;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // WAV header là 44 bytes
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);                              // ChunkID
  header.writeUInt32LE(36 + dataLength, 4);             // ChunkSize
  header.write('WAVE', 8);                              // Format
  header.write('fmt ', 12);                             // Subchunk1ID
  header.writeUInt32LE(16, 16);                         // Subchunk1Size (PCM = 16)
  header.writeUInt16LE(1, 20);                          // AudioFormat (PCM = 1)
  header.writeUInt16LE(numChannels, 22);                // NumChannels
  header.writeUInt32LE(sampleRate, 24);                 // SampleRate
  header.writeUInt32LE(byteRate, 28);                   // ByteRate
  header.writeUInt16LE(blockAlign, 32);                 // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);              // BitsPerSample
  header.write('data', 36);                             // Subchunk2ID
  header.writeUInt32LE(dataLength, 40);                 // Subchunk2Size

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return wavBuffer.toString('base64');
}

// -------------------------------------------------------------
//  Gọi Gemini TTS với 1 key và 1 model cụ thể
// -------------------------------------------------------------
async function callGeminiTTS(text: string, apiKey: string, model: string): Promise<GeminiAudio | null> {
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
            prebuiltVoiceConfig: { voiceName: 'Kore' } // Giọng nữ tự nhiên, hỗ trợ Tiếng Việt
          }
        }
      }
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err: any = new Error(`Gemini HTTP ${res.status}: ${errBody.substring(0, 200)}`);
    err.statusCode = res.status;
    throw err;
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!part?.data) {
    console.warn(`[Gemini TTS] Model ${model} trả về response nhưng không có audio data.`);
    return null;
  }

  let audioBase64 = part.data;
  let mimeType: string = part.mimeType || 'audio/wav';

  // Nếu Gemini trả PCM thô (audio/L16), cần bọc WAV header để trình duyệt phát được
  if (mimeType.startsWith('audio/L16') || mimeType.startsWith('audio/pcm')) {
    // Đọc sample rate từ mimeType. VD: "audio/L16;codec=pcm;rate=24000" → 24000
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    console.log(`[Gemini TTS] Phát hiện PCM thô (rate=${sampleRate}Hz). Đang chử WAV header...`);
    audioBase64 = pcmToWav(audioBase64, sampleRate);
    mimeType = 'audio/wav';
  }

  return { base64: audioBase64, mimeType };
}

// -------------------------------------------------------------
//  Xoay vòng qua tất cả Gemini keys + thử các model khác nhau
//  Luồng xử lý:
//   Key #1 + Model A  →  thành công ✅
//   Key #1 + Model A  →  429 Rate Limit  →  thử Key #2 + Model A
//   Key #1 + Model A  →  404 Not Found   →  thử Model B với Key #1
//   Tất cả đều thất bại → trả về null → kích hoạt Google Fallback
// -------------------------------------------------------------
async function tryGeminiWithRotation(text: string): Promise<GeminiAudio | null> {
  if (GEMINI_KEYS.length === 0) {
    console.warn('[Gemini TTS] Chưa cấu hình Gemini API Key nào → dùng Google Fallback.');
    return null;
  }

  const startIndex = currentKeyIndex;

  // Thử từng model
  for (const model of GEMINI_TTS_MODELS) {
    // Thử từng key với model này
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const keyIndex = (startIndex + i) % GEMINI_KEYS.length;
      const key = GEMINI_KEYS[keyIndex];

      try {
        console.log(`[Gemini TTS] Thử Key #${keyIndex + 1} + Model: ${model}...`);
        const result = await callGeminiTTS(text, key, model);

        if (result) {
          // Thành công → cập nhật key để lần sau bắt đầu từ key kế tiếp (tránh key 1 gánh hết)
          currentKeyIndex = (keyIndex + 1) % GEMINI_KEYS.length;
          console.log(`[Gemini TTS] ✅ Key #${keyIndex + 1} + Model ${model} thành công. mimeType: ${result.mimeType}`);
          return result;
        }

      } catch (err: any) {
        const code = err?.statusCode;

        if (code === 429) {
          console.warn(`[Gemini TTS] ⚠️  Key #${keyIndex + 1} bị Rate Limit (429). Thử key tiếp...`);
          continue; // Thử key kế tiếp với cùng model
        }

        if (code === 404) {
          console.warn(`[Gemini TTS] Model "${model}" không tồn tại (404). Thử model dự phòng...`);
          break; // Thoát vòng key, thử model tiếp theo
        }

        // Lỗi khác: 500, network, timeout... → ghi log và thử key tiếp
        console.error(`[Gemini TTS] ❌ Key #${keyIndex + 1} lỗi [${code ?? 'network/timeout'}]:`, err?.message?.substring(0, 150));
        continue;
      }
    }
  }

  console.warn('[Gemini TTS] Tất cả Keys + Models đều thất bại → dùng Google Dự Phòng.');
  return null;
}

// -------------------------------------------------------------
//  DỰ PHÒNG: Google Translate TTS (không cần API Key)
//  Giọng robot nhưng độ ổn định cao, không bao giờ bị rate limit
//  Mỗi chunk tối đa 180 ký tự (giới hạn của Google Dịch)
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
        console.error('[Google TTS Fallback] Lỗi chunk:', err?.message);
        return null;
      })
    );

  const results = await Promise.all(promises);
  return results.filter(Boolean) as string[];
}

// =============================================================
//  🚀 MAIN HANDLER
//  Thứ tự ưu tiên:
//    1. Gemini TTS (Key 1 ~ Key 3 xoay vòng, thử nhiều model)
//    2. Google Translate TTS (dự phòng cuối cùng, luôn hoạt động)
// =============================================================
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    // --- Ưu tiên 1: Gemini TTS ---
    const geminiAudio = await tryGeminiWithRotation(text);

    if (geminiAudio) {
      return NextResponse.json({
        chunks: [{ base64: geminiAudio.base64, mimeType: geminiAudio.mimeType }],
        source: 'gemini',
        mimeType: geminiAudio.mimeType,
      });
    }

    // --- Dự phòng: Google Translate TTS ---
    console.log('[TTS] Dùng Google Translate TTS dự phòng...');
    const fallbackChunks = await useGoogleFallback(text);

    if (fallbackChunks.length === 0) {
      // Cả 2 đường đều thất bại — emit spin_completed để game không bị treo
      console.error('[TTS] Google Fallback cũng thất bại! Trả về mảng rỗng.');
    }

    return NextResponse.json({
      chunks: fallbackChunks.map(b => ({ base64: b, mimeType: 'audio/mp3' })),
      source: 'google-fallback',
      mimeType: 'audio/mp3',
    });

  } catch (error: any) {
    console.error('[TTS] Lỗi server nghiêm trọng:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
