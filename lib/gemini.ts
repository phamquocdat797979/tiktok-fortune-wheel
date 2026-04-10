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
${ragInstruction || 'Không có dữ liệu wiki, phán dựa trên năng lượng chung ngày hôm nay.'}

Thông tin tử vi: [${contextStr}]
Lưu ý: ${infoNote}

CÁCH PHÁN:
- Gọi tên "${nickname}" ngay đầu câu, thân thiện tự nhiên.
- Đọc kỹ nội dung WIKI bên trên và diễn đạt lại bằng lời thầy tử vi — không theo cấu trúc cố định. Wiki đề cập gì thì phán đó.
- Nếu wiki có sự nghiệp, tình cảm, tài chính, sức khỏe... thì đề cập đúng thứ tự và tỉ trọng trong wiki.
- Nếu wiki ngắn (dưới 60 từ), bổ sung thêm nhận định dựa trên mệnh/tuổi/cung nhưng nhất quán tinh thần wiki.
- KHÔNG nhắc lại tên tuổi, tên cung, tên mệnh. Đi thẳng vào nội dung.
- KHÔNG gạch đầu dòng, không in đậm, không markdown. Văn xuôi liền mạch tự nhiên.
- Tổng độ dài: tối thiểu 100 từ, tối đa 150 từ.
- Cuối cùng: nêu 1 con số may mắn và 1 màu sắc may mắn, hẹn gặp lại ngày mai.

Bắt đầu phán:
`;

  const callGemini = async (promptText: string): Promise<string> => {
    const result = await model.generateContent(promptText);
    return result.response.text().trim();
  };

  // LẦN 1: Gọi với prompt đầy đủ
  try {
    return await callGemini(prompt);
  } catch (err: any) {
    console.error('❌ Gemini lần 1 thất bại:', err?.message || err);
  }

  // LẦN 2: Retry với prompt rút gọn
  const promptRetry = `
Bạn là thầy tử vi. Hôm nay ${dateStr}, phán vận mệnh cho "${nickname}".
${ragInstruction || 'Phán theo năng lượng tích cực ngày hôm nay.'}
Viết 100-150 từ văn xuôi, không markdown, cuối nêu số và màu may mắn. Bắt đầu bằng tên "${nickname}":`;

  try {
    return await callGemini(promptRetry);
  } catch (err2: any) {
    console.error('❌ Gemini lần 2 thất bại:', err2?.message || err2);
  }

  // FALLBACK CUỐI: Đọc thẳng wiki nếu có, không dùng hardcode
  if (dailyContext) {
    const wikiSnippet = dailyContext
      .split('\n')
      .filter(l => l.trim().length > 20)
      .slice(0, 3)
      .join(' ')
      .split(' ')
      .slice(0, 100)
      .join(' ');
    return `Chào ${nickname}, hôm nay ${dateStr} vũ trụ nhắn gửi tới bạn: ${wikiSnippet}... Hệ thống AI đang bảo trì, bạn vui lòng thử lại sau nhé!`;
  }

  return `Chào ${nickname}, vận số hôm nay của bạn tôi không thể đoán được. Hệ thống AI đang gặp sự cố, bạn vui lòng thử lại sau nhé!`;
}
