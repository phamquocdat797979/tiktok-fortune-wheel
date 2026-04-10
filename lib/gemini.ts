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
    ? `\nĐÂY LÀ DỮ LIỆU TỬ VI (WIKI) ĐƯỢC TẢI TỰ ĐỘNG CHO NGÀY HÔM NAY:\n"""\n${dailyContext}\n"""\nQUAN TRỌNG: Bạn BẮT BUỘC phải dựa vào nội dung WIKI trên làm cốt lõi của lời phán. Không được phán những thông tin trái ngược với WIKI. Nếu WIKI đề cập Sự nghiệp, Tình cảm, Tài chính thì lời phán phải phản ánh đúng xu hướng đó.`
    : '';

  // Nếu không có đủ context để phán chính xác => báo lỗi luôn
  if (!dailyContext && !astro.conGiap && !astro.cungHoangDao) {
    return `Chào ${nickname}, vận số hôm nay của bạn tôi không thể đoán được do thiếu dữ liệu tử vi. Hệ thống đang kiểm tra lại nguồn dữ liệu, bạn vui lòng thử lại sau nhé!`;
  }

  const prompt = `
Bạn là thầy tử vi đang trực tiếp phán vận mệnh hôm nay (${dayOfWeek}, ${dateStr}) cho người xem TikTok tên "${nickname}" trên livestream.
${ragInstruction ? ragInstruction : `Không có dữ liệu wiki, hãy phán dựa trên năng lượng chung ngày hôm nay.`}

Thông tin tử vi: [${contextStr}]
Lưu ý: ${infoNote}

CÁCH PHÁN:
- Gọi tên "${nickname}" ngay đầu câu, thân thiện tự nhiên như đang nói chuyện thật.
- Đọc kỹ nội dung WIKI bên trên và diễn đạt lại bằng lời của thầy tử vi — không cần theo bất kỳ cấu trúc mục nào cố định. Wiki đề cập gì thì phán đó, wiki nhiều mục thì phán trải dài, wiki ít mục thì đào sâu vào mục đó.
- Nếu wiki có thông tin về sự nghiệp, tình cảm, tài chính, sức khỏe... thì đề cập theo đúng thứ tự và tỉ trọng trong wiki — không tự ý đổi thứ tự hay thêm mục không có trong wiki.
- Nếu wiki quá ngắn (dưới 60 từ), hãy bổ sung thêm nhận định của riêng thầy dựa trên mệnh/tuổi/cung để đủ độ dài, nhưng phải nhất quán với tinh thần của wiki.
- KHÔNG nhắc lại con số tuổi, tên cung, tên mệnh vì màn hình đã hiển thị. Đi thẳng vào nội dung.
- KHÔNG dùng gạch đầu dòng, không in đậm, không markdown. Văn xuôi liền mạch, tự nhiên như nói miệng.
- Tổng độ dài: tối thiểu 100 từ, tối đa 150 từ.
- Cuối cùng: nêu 1 con số may mắn và 1 màu sắc may mắn, hẹn gặp lại ngày mai.

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
