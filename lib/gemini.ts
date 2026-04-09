import { GoogleGenerativeAI } from '@google/generative-ai';
import { AstrologyData } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateFortuneText(astro: AstrologyData, nickname: string = 'bạn', dailyContext: string = ''): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][today.getDay()];

  // Phân loại rõ thông tin có và thiếu để Gemini biết cách xử lý
  const hasYear = !!astro.conGiap;   // Có năm sinh => có con giáp & can chi
  const hasMonthDay = !!astro.cungHoangDao; // Có ngày+tháng => có cung hoàng đạo
  const hasFull = hasYear && hasMonthDay && !!astro.soChuDao; // Đầy đủ ngày/tháng/năm

  let infoNote = '';
  if (hasFull) {
    infoNote = 'Thông tin đầy đủ, hãy phán toàn diện.';
  } else if (hasYear && !hasMonthDay) {
    infoNote = 'Chỉ có Năm sinh. Hãy tập trung vào Can Chi (VD: tuổi Giáp Thân) và Mệnh ngũ hành. Phần Cung hoàng đạo hãy nói đại ý chung chung như “một người có trái tim nhạy cảm” mà không gọi tên cung cụ thể.';
  } else if (!hasYear && hasMonthDay) {
    infoNote = 'Chỉ có Ngày và Tháng sinh. Hãy tập trung vào Cung hoàng đạo. Phần Tuổi hãy nói đại ý như “người có chí định hướng rõ ràng” mà không gọi tên tuổi cụ thể.';
  } else {
    infoNote = 'Thông tin rất ít. Hãy phán theo năng lượng chung của ngày hôm nay một cách huyền bí và tự tin.';
  }

  const contextStr = [
    astro.canChi    ? `Tuổi (Can Chi): ${astro.canChi}` : null,
    astro.nguHanh   ? `Mệnh ngũ hành: ${astro.nguHanh}` : null,
    astro.cungHoangDao ? `Cung hoàng đạo: ${astro.cungHoangDao}` : null,
    astro.soChuDao  ? `Số chủ đạo: ${astro.soChuDao}` : null,
  ].filter(Boolean).join(', ') || 'Không có thông tin, dùng năng lượng ngày hôm nay';

  const ragInstruction = dailyContext 
    ? `\nĐÂY LÀ DỮ LIỆU TỬ VI (WIKI) DÀNH RIÊNG CHO NGÀY HÔM NAY TỪ HỆ THỐNG:\n"""\n${dailyContext}\n"""\nHãy chắt lọc và sử dụng dữ liệu trên làm cốt lõi cho lời phán của bạn.`
    : '';

  const prompt = `
Bạn là một thầy tử vi và phong thủy uyên bác đang phán thẻ vận mệnh NGAY HÔM NAY cho người xem tên "${nickname}".

Thông tin tử vi của họ (Dùng để lấy năng lượng, KHÔNG ĐƯỢC nhắc lại các thông tin này trong bài phán vì màn hình đã hiển thị rồi): [${contextStr}]
Lưu ý: ${infoNote}${ragInstruction}

YÊU CẦU BẮT BUỘC:
1. Mở đầu bằng cách gọi tên "${nickname}" thật thân thiện (VD: "Chào ${nickname}," hoặc "${nickname} thân mến,"). TUYỆT ĐỐI KHÔNG nhắc lại tuổi, mệnh, hay cung hoàng đạo của họ để tránh tốn thời gian. Vào thẳng vấn đề luôn.
2. Nội dung tiếp theo tập trung đi sâu vào phán vận mệnh cho NGÀY HÔM NAY (dựa trên WIKI nếu có). Phân tích chi tiết và có chiều sâu về 2 khía cạnh chính:
   - Công việc / Tài lộc: Hôm nay có cơ hội hay rủi ro gì? Cần làm gì để giữ tiền?
   - Tình cảm / Mối quan hệ: Tương tác với người xung quanh sẽ thế nào?
3. ĐƯA RA LỜI KHUYÊN HÀNH ĐỘNG CỤ THỂ, đừng nói chung chung.
4. TUYỆT ĐỐI VIẾT ĐOẠN VĂN DÀI TỐI THIỂU 100-120 TỪ! Đây là bắt buộc để thời gian chưng cất vừa đủ cho âm thanh đọc. Nếu viết ngắn hơn 100 từ sẽ bị lỗi hệ thống.
5. Văn xuôi mượt mà, không gạch đầu dòng, không in đậm, không markdown. Viết tự nhiên như nói chuyện.
6. Kết thúc bằng 1 con số may mắn, 1 màu sắc may mắn và lời chào hẹn gặp lại ngày mai ngắn gọn.

Bắt đầu phán:
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error('Lỗi Gemini API:', err);
    return `Chào ${nickname}, vũ trụ hôm nay mang đến cho bạn một luồng sinh khí cực kỳ mạnh mẽ để dọn dẹp những vướng mắc cũ. Trong công việc, đây là thời điểm vàng để bạn đưa ra những quyết định dứt khoát, đừng chần chừ hay e ngại sự phán xét của người khác vì bạn đang đi đúng hướng. Về mặt tài chính, hãy thắt chặt hầu bao và tránh những lời mời gọi đầu tư dường như quá hoàn hảo. Trong chuyện tình cảm, sự bao dung và lắng nghe nương tựa vào nhau sẽ giúp bạn hóa giải mọi hiểu lầm vặt vãnh. Đừng quên dành cho bản thân mười phút tĩnh tâm vào cuối ngày nhé. Số may mắn của bạn hôm nay là 9, màu sắc mang lại bình an là màu xanh dương. Hãy quay lại vào ngày mai để đón nhận thêm năng lượng mới!`;
  }
}
