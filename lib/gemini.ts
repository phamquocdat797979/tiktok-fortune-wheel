import { GoogleGenerativeAI } from '@google/generative-ai';
import { AstrologyData } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateFortuneText(astro: AstrologyData, nickname: string = 'bạn', dailyContext: string = ''): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][today.getDay()];

  const hasYear = !!astro.conGiap;
  const hasMonthDay = !!astro.cungHoangDao;
  const hasFull = hasYear && hasMonthDay && !!astro.soChuDao;

  let infoNote = '';
  if (hasFull) {
    infoNote = 'Thông tin đầy đủ, hãy phán toàn diện.';
  } else if (hasYear && !hasMonthDay) {
    infoNote = 'Chỉ có Năm sinh. Tập trung vào Can Chi và Mệnh ngũ hành. Không gọi tên cung cụ thể.';
  } else if (!hasYear && hasMonthDay) {
    infoNote = 'Chỉ có Ngày và Tháng sinh. Tập trung vào Cung hoàng đạo. Không gọi tên tuổi cụ thể.';
  } else {
    infoNote = 'Thông tin ít. Phán theo năng lượng chung ngày hôm nay.';
  }

  const contextStr = [
    astro.canChi       ? `Tuổi (Can Chi): ${astro.canChi}` : null,
    astro.nguHanh      ? `Mệnh ngũ hành: ${astro.nguHanh}` : null,
    astro.cungHoangDao ? `Cung hoàng đạo: ${astro.cungHoangDao}` : null,
    astro.soChuDao     ? `Số chủ đạo: ${astro.soChuDao}` : null,
  ].filter(Boolean).join(', ') || 'Không có thông tin';

  const ragInstruction = dailyContext
    ? `\nĐÂY LÀ DỮ LIỆU TỬ VI (WIKI) ĐƯỢC TẢI TỰ ĐỘNG CHO NGÀY HÔM NAY:\n"""\n${dailyContext}\n"""\nQUAN TRỌNG: Bắt buộc phải dựa vào WIKI trên làm cốt lõi. Không phán trái ngược với WIKI.`
    : '';

  // Thiếu hoàn toàn => báo lỗi ngay
  if (!dailyContext && !astro.conGiap && !astro.cungHoangDao) {
    return `Chào ${nickname}, vận số hôm nay của bạn tôi không thể đoán được do thiếu dữ liệu tử vi. Hệ thống đang kiểm tra lại nguồn dữ liệu, bạn vui lòng thử lại sau nhé!`;
  }

  const prompt = `
Bạn là thầy tử vi đang phán vận mệnh hôm nay (${dayOfWeek}, ${dateStr}) cho người xem TikTok tên "${nickname}".
${ragInstruction ? ragInstruction : `Không có dữ liệu văn bản tử vi cụ thể, hãy phán dựa trên năng lượng chung.`}

Thông tin tử vi của người này: [${contextStr}]
Lưu ý: ${infoNote}

YÊU CẦU QUAN TRỌNG VỀ PHONG CÁCH:
- Bắt đầu: Gọi tên "${nickname}" ngay lập tức, lời chào thân mật, tự nhiên. Tránh nhắc lại máy móc các thông số ngày sinh/cung/mệnh vì đã có trên màn hình.
- Nội dung: Hãy là một người kể chuyện (narrator). Đọc WIKI bên trên, chọn lọc những ý quan trọng nhất và kết nối chúng thành một đoạn văn xuôi mượt mà. 
- TUYỆT ĐỐI KHÔNG chia mục, không liệt kê tiêu đề kiểu "Sự nghiệp:", "Tình cảm:", "Tài chính:". Hãy lồng ghép các khía cạnh đó vào một câu chuyện duy nhất.
- Độ dài (100-150 từ): 
   + Nếu WIKI quá ngắn: Hãy dùng kiến thức tử vi của bạn để bình phẩm thêm về tính cách hoặc đưa ra những lời khuyên động viên phù hợp với người có [${contextStr}] để đạt đủ số từ yêu cầu.
   + Nếu WIKI quá dài: Hãy cô đọng lại, chỉ giữ lại những gì "đắt" nhất và dễ nghe nhất khi đọc lên.
- Văn phong: Bình dân, huyền bí nhưng gần gũi, không dùng gạch đầu dòng, không in đậm, không Markdown. 
- Kết thúc: Nêu 1 con số may mắn, 1 màu sắc may mắn và lời chào ngắn gọn.

Bắt đầu phán:
`;

  const callGemini = async (promptText: string): Promise<string> => {
    const result = await model.generateContent(promptText);
    return result.response.text().trim();
  };

  try {
    return await callGemini(prompt);
  } catch (err: any) {
    console.error('❌ Gemini API Error:', err?.message || err);
    return `Chào ${nickname}, vận số hôm nay của bạn tôi không đoán được. Hệ thống đang bảo trì, bạn hãy thử lại sau nhé!`;
  }
}
