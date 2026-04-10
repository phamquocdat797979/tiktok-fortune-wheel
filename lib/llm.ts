import Groq from 'groq-sdk';
import { AstrologyData } from './types';

// Danh sách các API Key để dự phòng (Fallback)
const API_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_SCRAPER_API_KEY
].filter(key => key && !key.includes('điền_key_'));

let currentKeyIndex = 0;
let groq: Groq | null = null;

function getGroq(forceNew = false) {
  if (API_KEYS.length === 0) {
    console.error("❌ LỖI: Không tìm thấy bất kỳ Groq API Key nào trong .env");
    return new Groq({ apiKey: '' });
  }

  if (!groq || forceNew) {
    const key = API_KEYS[currentKeyIndex];
    console.log(`🔌 Đang kết nối Groq với API Key #${currentKeyIndex + 1}...`);
    groq = new Groq({ apiKey: key || '' });
  }
  return groq;
}

function rotateKey() {
  if (API_KEYS.length <= 1) return false;
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`🔄 Tự động chuyển sang API Key dự phòng #${currentKeyIndex + 1}...`);
  getGroq(true);
  return true;
}

export async function generateFortuneText(astro: AstrologyData, nickname: string = 'bạn', dailyContext: string = ''): Promise<{ text: string, usage?: any, limits?: any }> {
  const modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][today.getDay()];

  const contextStr = [
    astro.canChi       ? `Tuổi (Can Chi): ${astro.canChi}` : null,
    astro.nguHanh      ? `Mệnh ngũ hành: ${astro.nguHanh}` : null,
    astro.cungHoangDao ? `Cung hoàng đạo: ${astro.cungHoangDao}` : null,
    astro.soChuDao     ? `Số chủ đạo: ${astro.soChuDao}` : null,
  ].filter(Boolean).join(', ') || 'Không có thông tin';

  const ragInstruction = dailyContext
    ? `\nĐÂY LÀ DỮ LIỆU TỬ VI (WIKI) NGÀY HÔM NAY:\n"""\n${dailyContext}\n"""\nQUAN TRỌNG: Bạn BẮT BUỘC phải dựa vào WIKI trên làm cốt lõi. Không được phán trái ngược với WIKI.`
    : '';

  if (!dailyContext && !astro.conGiap && !astro.cungHoangDao) {
    return { text: `Chào ${nickname}, vận số hôm nay của bạn tôi không thể đoán được do thiếu dữ liệu tử vi. Hệ thống đang kiểm tra lại nguồn dữ liệu, bạn vui lòng thử lại sau nhé!` };
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

  async function tryRequest(): Promise<any> {
    const groqInstance = getGroq();
    try {
        const { data, response } = await groqInstance.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: modelName,
          temperature: 0.7,
          max_tokens: 500,
        }).withResponse();
        
        const text = data.choices[0]?.message?.content?.trim() || `Chào ${nickname}, vận số hôm nay của bạn tôi không đoán được.`;
        
        const limits = {
          remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
          remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
          resetRequests: response.headers.get('x-ratelimit-reset-requests'),
          resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
        };

        return { text, usage: data.usage, limits };
    } catch (err: any) {
        // Nếu lỗi 429 (Rate Limit) và còn Key khác thì xoay key
        if (err?.status === 429 && rotateKey()) {
            console.warn("⚠️ Chạm giới hạn Groq, đang thử lại bằng Key dự phòng...");
            return await tryRequest();
        }
        throw err;
    }
  }

  try {
    return await tryRequest();
  } catch (err: any) {
    console.error('❌ Groq API Final Error:', err?.message || err);
    return { text: `Chào ${nickname}, vận số hôm nay của bạn tôi không đoán được. Hệ thống đang bận, bạn vui lòng đợi ít phút nhé!` };
  }
}
