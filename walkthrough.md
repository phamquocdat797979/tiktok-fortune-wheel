# Kiến Trúc Dưới Mái Tôn Của Game Tâm Linh 🕵️‍♂️ (Dành cho Developer)

Chào bạn, tài liệu này tóm tắt cấu trúc code và luồng dữ liệu (Data Pipeline) của dự án **TikTok Fortune Wheel**. Nếu bạn muốn bảo trì hệ thống, bảo dưỡng API hoặc bổ sung tính năng mới, thì đây là bản đồ chỉ đường dành riêng cho bạn.

Hiện tại game đã loại bỏ hoàn toàn các chức năng rườm rà dư thừa về thuật toán ngẫu nhiên cũ (random seeds, boss, idle). Trọng tâm giờ đây là: **Dữ liệu mộc cào từ website, kết hợp với AI Tốc Độ Cao (Groq), và Hệ thống hàng đợi WebSocket.**

> [!TIP]
> **Về việc chọn AI**
> Thay vì sử dụng Gemini có phần chậm chạp như các phiên bản cũ, hệ thống đang dùng model thuộc Llama 3 chạy nền tảng mạng lưới LPU của Groq để sinh ra text trong thời gian siêu tưởng (chỉ dưới 2 giây). Giúp dòng thời gian "spin" bánh xe luôn liền mạch.

---

## Các Thành Phần Hệ Thống (Mô Hình 4 Mảnh Ghép)

### 1. `server.ts` (Sự Kiện Trung Tâm & WebSocket)
Đây là cầu nối mạng giữa Tiktok, Game và Control Panel.
- Sử dụng `tiktok-live-connector` để lắng nghe mọi comment, gift, share.
- Tích hợp bộ chặn Spam và kiểm tra Ngày Sinh Tương Lai.
- Quản lý **Hàng đợi Ưu tiên (Priority Queue)**:
   - Hệ thống đánh giá dựa trên mức độ Support (Quy đổi 1 XU đập thẳng lên VIP).
   - Truyền tải list Queue về Frontend liên tục.

### 2. `workers/spinWorker.ts` (Xử Lý Ngầm Không Lỗi Nhịp)
Nhận data ngày sinh trực tiếp từ Queue của Server, và thực hiện việc nặng:
- **Tập hợp lá số tử vi (`lib/astrology.ts`)**: Tính toán Cung Hoàng Đạo & Cung Con Giáp.
- **Tiêu thụ dữ liệu (`Cào Data Offline`)**: Ghép vào nội dung tử vi đã cào chuẩn bị sẵn từ thư mục `data/daily_wiki/`.
- **Hỏi AI (`lib/llm.ts`)**: Gọi Groq Llama3 tóm tắt lá số sao cho gọn, đậm chất thầy bói. Nó sẽ xoay vòng tự động 3 key API nếu có bị lỗi rate-limit.
- Bộ máy đếm giờ Timer (Circuit breaker 60s): Đảm bảo không bị "treo" hay kẹt 1 ai đó, luồng game luôn diễn ra.

### 3. `src/app/api/tts/route.ts` (Cỗ Máy Chuyển Ngữ Google TTS)
Hoạt động cực kỳ ổn định phục vụ cho việc đọc kết quả:
- Để lách luật và không bị block từ Google Dịch, hệ thống dùng code server proxy chia text thành từng đoạn nhỏ dưới 180 ký tự.
- Gửi xuống client cục Buffer định dạng `base64`.
- Tránh trình duyệt bị tràn bộ nhớ khi chơi một file Base64 siêu bự, các đoạn văn được chia nhỏ thành nhạc MP3 mượt mà.

### 4. Giao Diện (Vòng quay & Control Panel)
- **`src/app/control-panel/page.tsx`**: Bảng tổng phím nóng điều phối nhạc nền (`music volume ducking`), cài API Key và chạy lệnh vòng quay. Bản thân Control Panel chịu trách nhiệm bắn API TTS, phát audio và thông báo Game Đã Hoàn Thành (`spin_completed`).
- **`src/app/screen/page.tsx`**: Dùng `Html5 Canvas` để Render bánh xe Ngũ Hành chia 12 ô bản mệnh cực đẹp và hiện thông báo bí kíp hoàng kim. Hệ thống chống đọc đúp bằng `ttsEmittedRef` ở trang này.

---

## 🛠 Bộ Cào Dữ Liệu Offline (Web Scraper)
Hệ thống sử dụng Cheerio để hằng ngày lên cào lá số tử vi nhằm cung cấp tư liệu "giữ lửa" liên tục cho hệ thống AI khỏi bị "bí lời giải".

> [!WARNING]
> Mọi tệp sinh ra từ quá trình cào này đều được bỏ vào thư mục `data/daily_wiki/*`.

Có 2 kịch bản (Script):
- `npm run fetch:tuoi` - Cào vận mệnh 12 con giáp hằng ngày.
- `npm run fetch:cung` - Cào vận mệnh 12 cung hoàng đạo.

Trong mỗi Cron Job, file `scripts/update_....ts` sẽ tiến hành bóc tách HTML, chọn ra đúng phân đoạn ngày mới nhất, và lưu trữ dạng Markdown (`.md`).
`spinWorker.ts` sẽ kết nối và rút thông tin này ra đưa chèn vào Text của LLM.

## Trạng Thái Dự Án

- Cấu trúc hệ thống ở thời điểm hiện tại là gọn nhẹ, zero-fluff, loại trừ tối đa rác lưu trữ (`scratch`, `dump`), mọi tính năng đã được kiểm thử vững chãi theo cơ chế tự đứng lên sau sai sót (auto fallback). Các lỗi bộ đệm và lỗi vòng đai API đều đã khép kín hoàn hảo.

Chúc bạn có một chặng đường bảo trì suôn sẻ trong tương lai!
