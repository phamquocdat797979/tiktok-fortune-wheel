import { GoogleGenerativeAI } from '@google/generative-ai';
import { AstrologyData } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateFortuneText(astro: AstrologyData, nickname: string = 'bạn'): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][today.getDay()];

  // Phân loại rõ thông tin có và thiếu để Gemini biết cách xử lý
  const hasYear = !!astro.conGiap;   // Có năm sinh => có con giáp
  const hasMonthDay = !!astro.cungHoangDao; // Có ngày+tháng => có cung hoàng đạo
  const hasFull = hasYear && hasMonthDay && !!astro.soChuDao; // Đầy đủ ngày/tháng/năm

  let infoNote = '';
  if (hasFull) {
    infoNote = 'Thông tin đầy đủ, hãy phán toàn diện.';
  } else if (hasYear && !hasMonthDay) {
    infoNote = 'Chỉ có Năm sinh. Hãy tập trung vào Con giáp và Mệnh ngũ hành. Phần Cung hoàng đạo hãy nói đại ý chung chung như “một người có trái tim nhạy cảm” mà không gọi tên cung cụ thể.';
  } else if (!hasYear && hasMonthDay) {
    infoNote = 'Chỉ có Ngày và Tháng sinh. Hãy tập trung vào Cung hoàng đạo. Phần Con giáp hãy nói đại ý như “người có chí định hướng rõ ràng” mà không gọi tên con giáp cụ thể.';
  } else {
    infoNote = 'Thông tin rất ít. Hãy phán theo năng lượng chung của ngày hôm nay một cách huyền bí và tự tin.';
  }

  const contextStr = [
    astro.conGiap   ? `Con giáp: ${astro.conGiap}` : null,
    astro.canChi    ? `Năm âm lịch: ${astro.canChi}` : null,
    astro.nguHanh   ? `Mệnh: ${astro.nguHanh}` : null,
    astro.cungHoangDao ? `Cung hoàng đạo: ${astro.cungHoangDao}` : null,
    astro.soChuDao  ? `Số chủ đạo: ${astro.soChuDao}` : null,
  ].filter(Boolean).join(', ') || 'Không có thông tin, dùng năng lượng ngày hôm nay';

  const prompt = `
Bạn là một thầy thiên văn và tử vi hàng đầu trong show truyền hình tương tác trên TikTok Live.
Hôm nay là ${dayOfWeek}, ngày ${dateStr}. Bạn đang phán vận NGAY HÔM NAY cho khán giả tên TikTok là "${nickname}".

Thông tin chiên tiết của họ: [${contextStr}]
Lưu ý: ${infoNote}

YÊU CẦU:
1. Mở đầu bằng cách gọi tên "${nickname}" và KHẲNG ĐỊNH NGAY cung/mệnh của họ (dựa trên Thông tin chi tiết). Ví dụ: "${nickname} thuộc cung Sư Tử ơi..." hoặc "Chào ${nickname} mang mệnh Thủy...". Đây là cách để họ biết hệ thống đã bắt đúng ngày sinh của họ.
2. Nội dung tiếp theo hướng về việc phán vận cho NGÀY HÔM NAY. Giọng điệu hợp thời, sống động. (TUYỆT ĐỐI KHÔNG đọc cụm "7/4/2026" hay ngày tháng hiện tại ra làm họ rôi rắm tưởng nhầm đó là ngày sinh của họ, chỉ dùng từ "hôm nay").
3. Đan xen đủ: Tài lộc hôm nay, Tình duyên hôm nay, Con số may mắn, Lời khuyên ngắn.
4. Tổng cộng KHOẢNG 80–90 từ. Văn xuôi mượt, không gạch đầu dòng, không in đậm, không markdown. Viết tự nhiên như nói chuyện (sẽ được đọc qua TTS).
5. Kết thúc bằng màu may mắn và lời mời quáng cáo quay lại ngày mai.

Phán ngay bây giờ:
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error('Lỗi Gemini API:', err);
    const d = dayOfWeek;
    const fbGiap = astro.conGiap ? `tuổi ${astro.conGiap}` : '';
    const fbCung = astro.cungHoangDao ? `cung ${astro.cungHoangDao}` : '';
    return `${nickname} ơi, hôm nay ${d} vũ trụ gửi đến bạn ${fbGiap} ${fbCung} một ngày đầy năng lượng. Tài lộc đang ở trước mặt, chỉ cần bạn chủ động dứt khoát. Tình duyên thuận lợi nếu bạn mở lòng. Con số may mắn hôm nay là số 8, màu xanh lá sẽ mang đến bình an. Hãy quay lại ngày mai để xem vận mệnh tiếp theo nhé!`;
  }
}
