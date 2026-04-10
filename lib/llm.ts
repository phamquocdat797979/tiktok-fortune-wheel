import Groq from 'groq-sdk';
import { AstrologyData } from './types';

// ===== HỆ THỐNG LUÂN CHUYỂN 3 API KEY =====
// Lấy tất cả key hợp lệ từ env, theo thứ tự ưu tiên
const RAW_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_SCRAPER_API_KEY,
  process.env.GROQ_API_KEY_3,
];

const API_KEYS: string[] = RAW_KEYS.filter(
  (k): k is string => typeof k === 'string' && k.trim().startsWith('gsk_')
);

if (API_KEYS.length === 0) {
  console.error('❌ FATAL: Không tìm thấy bất kỳ Groq API Key nào trong .env!');
}

// Trạng thái luân chuyển (dùng module-level để giữ vị trí key giữa các request)
let currentKeyIndex = 0;
let groqClient: Groq | null = null;

function buildClient(index: number): Groq {
  const key = API_KEYS[index];
  console.log(`🔌 Groq → Đang dùng Key #${index + 1}/${API_KEYS.length}`);
  return new Groq({ apiKey: key });
}

function getGroq(): Groq {
  if (!groqClient) {
    groqClient = buildClient(currentKeyIndex);
  }
  return groqClient;
}

/**
 * Xoay sang key tiếp theo trong danh sách (vòng tròn)
 * Trả về true nếu còn key khác, false nếu đã thử hết
 */
function rotateToNextKey(): boolean {
  if (API_KEYS.length <= 1) return false;
  const nextIndex = (currentKeyIndex + 1) % API_KEYS.length;
  if (nextIndex === currentKeyIndex) return false; // Đã vòng hết về key cũ -> không còn key mới
  currentKeyIndex = nextIndex;
  groqClient = buildClient(currentKeyIndex); // Tạo client mới với key mới
  console.log(`🔄 Đã chuyển sang Key #${currentKeyIndex + 1}/${API_KEYS.length}`);
  return true;
}

// ===== HÀM BÓI CHÍNH =====
export async function generateFortuneText(
  astro: AstrologyData,
  nickname: string = 'bạn',
  dailyContext: string = ''
): Promise<{ text: string; usage?: any; limits?: any }> {
  const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][today.getDay()];

  const contextStr =
    [
      astro.canChi ? `Tuổi (Can Chi): ${astro.canChi}` : null,
      astro.nguHanh ? `Mệnh ngũ hành: ${astro.nguHanh}` : null,
      astro.cungHoangDao ? `Cung hoàng đạo: ${astro.cungHoangDao}` : null,
      astro.soChuDao ? `Số chủ đạo: ${astro.soChuDao}` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'Không có thông tin';

  const ragInstruction = dailyContext
    ? `\nĐÂY LÀ DỮ LIỆU TỬ VI (WIKI) NGÀY HÔM NAY:\n"""\n${dailyContext}\n"""\nQUAN TRỌNG: Bạn BẮT BUỘC phải dựa vào WIKI trên làm cốt lõi. Không được phán trái ngược với WIKI.`
    : '';

  if (!dailyContext && !astro.conGiap && !astro.cungHoangDao) {
    return {
      text: `Chào ${nickname}, vận số hôm nay của bạn tôi không thể đoán được do thiếu dữ liệu tử vi. Hệ thống đang kiểm tra lại nguồn dữ liệu, bạn vui lòng thử lại sau nhé!`,
    };
  }

  const prompt = `
Bạn là thầy tử vi đang phán vận mệnh hôm nay (${dayOfWeek}, ${dateStr}) cho người xem TikTok tên "${nickname}".
${ragInstruction ? ragInstruction : `Không có dữ liệu văn bản tử vi cụ thể, hãy phán dựa trên năng lượng chung.`}

Thông tin tử vi của người này: [${contextStr}]

YÊU CẦU QUAN TRỌNG VỀ PHONG CÁCH:
- Bắt đầu: Gọi tên "${nickname}" ngay lập tức, lời chào thân mật, tự nhiên. Tránh nhắc lại máy móc các thông số ngày sinh/cung/mệnh vì đã có trên màn hình.
- Nội dung: Hãy là một người kể chuyện (narrator). Đọc WIKI bên trên, chọn lọc những ý quan trọng nhất và kết nối chúng thành một đoạn văn xuôi mượt mà, tinh tế.
- TUYỆT ĐỐI KHÔNG chia mục, không liệt kê tiêu đề kiểu "Sự nghiệp:", "Tình cảm:". Hãy lồng ghép các khía cạnh đó vào một đoạn văn duy nhất.
- Độ dài (100-150 từ): 
   + Nếu WIKI ngắn: Dùng kiến thức tử vi của bạn để bình phẩm thêm về tính cách hoặc đưa ra lời khuyên phù hợp với [${contextStr}] để đủ độ dài.
   + Nếu WIKI dài: Cô đọng lại, chỉ giữ lại những gì "đắt" nhất và dễ nghe nhất.
- Văn phong: Bình dân, huyền bí nhưng gần gũi, không dùng gạch đầu dòng, không in đậm, không Markdown. 
- Kết thúc: Nêu 1 con số may mắn, 1 màu sắc may mắn và lời chào ngắn gọn.

Bắt đầu phán:
`;

  // ===== TỰ ĐỘNG THỬ LẠI VỚI KEY KẾ TIẾP KHI HẾT HẠN MỨC =====
  const maxAttempts = API_KEYS.length; // Thử tối đa số lượng key có sẵn
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const { data, response } = await getGroq()
        .chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: modelName,
          temperature: 0.7,
          max_tokens: 500,
        })
        .withResponse();

      const text =
        data.choices[0]?.message?.content?.trim() ||
        `Chào ${nickname}, vận số hôm nay của bạn tôi không đoán được.`;

      const limits = {
        remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
        remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
        resetRequests: response.headers.get('x-ratelimit-reset-requests'),
        resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
        activeKeyIndex: currentKeyIndex + 1,
        totalKeys: API_KEYS.length,
      };

      return { text, usage: data.usage, limits };
    } catch (err: any) {
      const is429 = err?.status === 429;
      const is413 = err?.status === 413;

      if ((is429 || is413) && attempts < maxAttempts) {
        console.warn(`⚠️ Key #${currentKeyIndex + 1} bị giới hạn (${err.status}). Đang chuyển key...`);
        const rotated = rotateToNextKey();
        if (!rotated) {
          console.error('❌ Tất cả API Key đều đã bị giới hạn!');
          break;
        }
        // Tiếp tục thử với key mới
        continue;
      }

      // Lỗi khác (không phải rate limit) -> dừng ngay
      console.error(`❌ Groq API Error (Key #${currentKeyIndex + 1}):`, err?.message || err);
      break;
    }
  }

  return {
    text: `Chào ${nickname}, hệ thống bói đang bận xử lý quá nhiều người cùng lúc. Bạn vui lòng thử lại sau ít phút nhé!`,
  };
}
