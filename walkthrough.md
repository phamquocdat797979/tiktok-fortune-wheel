# Hoàn tất Tái cấu trúc Game Sinh Thần Vận Mệnh 🔮

Chào bạn, hệ thống tương tác bằng AI dành cho **Game Sinh Thần Vận Mệnh** (phiên bản mới) đã chính thức được thay máu toàn bộ cấu trúc và giao diện. Tôi đã lược bỏ hết các thành phần thừa gốc và trang bị trí tuệ nhân tạo (Gemini) để game hoạt động đúng chuẩn một "thầy phán" trên sóng livestream.

> [!TIP]
> **Nhật ký thay đổi**
> Game hiện tại không còn sử dụng dữ liệu tĩnh 32 ô và cấp bậc tier quà tặng. Chúng đã được thay thế bằng một giao diện 12 ô bản mệnh cực kỳ gọn gàng với thuật toán dự đoán AI.

## Các Thay Đổi Chính Đã Thực Hiện

### 1. Phân Tích Thông Tin Từ Dữ Liệu Ngày Sinh (Astrology Logic)
- Xóa bỏ module random tĩnh dư thừa `slotsData`, `tierMapping`, `idle`, `dailySeed`, `bossEvent`.
- Viết mới `lib/astrology.ts` thực hiện regex trích xuất Ngày/Tháng/Năm từ luồng Chat.
- Thuật toán nhanh: Tính Ngũ Hành (Kim, Mộc, Thủy, Hỏa, Thổ), tìm Con Giáp (Dựa trên hàng Can Chi), và Cung Hoàng Đạo Dương Lịch.

### 2. Tích Hợp Gemini 1.5 Text-generation Cấp Tốc
- Sinh Prompt động dựa trên dữ kiện đã lọc được từ Astrology `lib/gemini.ts`.
- Nếu AI bị lỗi hoặc nghẽn mạng, cơ chế **Circuit Breaker** (phương án Fallback) sẽ tự động kích hoạt để nhả ra một mẫu text cứu cánh, đảm bảo dòng chảy livestream không bị kẹt cứng (không bao giờ bị tắc nghẽn queue phòng chờ).

### 3. Hệ Thống Xếp Hàng Ưu Tiên (Priority Queue chống nghẽn)
- Mod lại `server.ts` đóng vai trò bộ đệm tương tác trực tiếp (`Live User State`).
- Lắng nghe event `like`, `share`, `gift` và **cộng dồn điểm VIP ưu tiên**.
- Khi một comment ngày sinh được ném vào:
   - VIP sẽ nhảy lên số 1 ngay lập tức nhờ `queue.ts` sort ưu tiên cao nhất.
   - User không được spam liên tục (Bị limit Cooldown 5 phút nội bộ).
- `spinWorker.ts` tự động chích Job và thực thi Gemini ngầm trong 7 giây chờ bánh xe xoay để tối ưu triệt để thời gian Delay.

### 4. Thiết Kế Lại Vòng Quay 12 Ô Ngũ Hành
- Lược bỏ 32 ô xám cũ trong `WheelCanvas.tsx`.
- Sơn đè màu chia theo 5 tông **Ngũ Hành**: Bạc (Kim), Xanh Lá (Mộc), Xanh Dương (Thủy), Đỏ tươi (Hỏa), Nâu Vàng (Thổ).
- Layout 12 ô xen kẽ đủ 12 Con Giáp và 12 Cung Hoàng Đạo. Hệ thống luôn đảm bảo mũi tên chỉ đúng vào một ô có Con Giáp hoặc Cung Hoàng Đạo tương ứng nếu hệ thống bắt được ngày sinh đầy đủ.

### 5. Lược Bỏ Hiệu Ứng Tier, Focus vào Vận Mệnh
- Hủy bỏ `TierEffectCanvas` gây rối mắt.
- Thay thế Popup hiện kết quả ở `page.tsx` thành màn Cẩm nang bí kíp với chữ Vàng Hoàng Kim ma mị. Nội dung text của Gemini sau khi fetch xong sẽ tự động hiện lên màn hình và Chị Google TTS sẽ tự động đọc.
- Bố trí lại bảng **Control Panel** cho Admin test ngày sinh bằng tay cực dễ dàng.

## Hướng Dẫn Kiểm Thử

> [!IMPORTANT]
> Bạn đừng quên chuẩn bị 1 API Key của Gemini nếu muốn test nhé!

1. Tạo file `.env` chứa `GEMINI_API_KEY=AIzaSy...`.
2. Khởi chạy bằng `npm run dev`.
3. Mở Control Panel (`http://localhost:3000/control-panel`).
4. Nhập tên và Ngày sinh ngẫu nhiên ở phần Input Admin và ấn "Bắn".
5. Bật một tab OBS (hay `/screen`) để chiêm ngưỡng vòng quay xoay và kết quả do AI sinh ra!

Nếu gặp lỗi build hãy chạy `npm install` một lần nữa để cài thêm thư viện liên quan của Gemini nếu cần! Giai đoạn tái cấu trúc toàn diện này đã kết thúc, bạn có thể kiểm thử.
