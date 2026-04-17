# Game Tử Vi Tâm Linh trên TikTok Livestream 🔮

Chào mừng bạn đến với **Game Sinh Thần Vận Mệnh**, một tựa game tương tác tự động dành cho các Streamer trên nền tảng TikTok. Game có khả năng đọc bình luận chứa **Ngày/Tháng/Năm Sinh**, dự đoán Tử Vi 12 Con Giáp & Cung Hoàng Đạo bằng máy học (LLM), sau đó hiển thị vòng quay và đọc kết quả (TTS) trực tiếp trên livestream.

## 🚀 Tính năng nổi bật
1. **Quét Comment Ngày Sinh Tự Động:** Kết nối trực tiếp với phòng live TikTok. Tự nhận diện và chặn các dạng spam hoặc "ngày sinh tương lai".
2. **Hệ Thống Hàng Đợi (Priority Queue) Thông Minh:** Ưu tiên ngay lập tức cho những vị khách "vibe" mạnh (Tặng Xu, Thả Tim, Share) để được quay vòng quay trước.
3. **Cơ Sở Dữ Liệu Offline + AI (LLM):** Kết hợp các quẻ bói cào từ web lớn (được cập nhật liên tục) với sức mạnh phân tích của Groq API (giúp tóm tắt siêu nhanh).
4. **Vòng Quay 12 Ô Ngũ Hành:** Đồ họa phong thủy chuyên nghiệp, hiệu ứng âm thanh sống động tự động tăng/giảm âm lượng nền.
5. **Google Text-to-Speech (TTS):** Tự động đọc lưu loát nội dung quẻ bói mà không cần API Key, chống giật lác với cơ chế chia nhỏ câu.

## 📦 Hướng dẫn cài đặt

Dự án yêu cầu cài đặt **[Node.js](https://nodejs.org/en)** phiên bản >= 18.

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi động máy chủ Server và Client
npm run dev
```

## 🎮 Cách thức vận hành

Hệ thống được chia làm hai màn hình độc lập:

1. **Màn hình OBS Livestream (`http://localhost:3000/screen`):**
   - Dùng để dán vào trình duyệt nhúng của phần mềm OBS (Kích thước 1080 x 1920).
   - Nơi hiển thị vòng quay phán xét, popup kết quả, và phát ra âm thanh.

2. **Màn hình Quản Lý - Control Panel (`http://localhost:3000/control-panel`):**
   - Bảng điều khiển dành riêng cho Streamer.
   - Nơi kết nối tài khoản TikTok (nhập `@tendangnhap` TikTok).
   - Nơi điền các API Key của Groq để khởi chạy mô hình AI cực tốc.
   - Chứa bộ điều khiển âm lượng, test thử vòng quay bằng tay, và theo dõi log hệ thống.

## 🔑 Thiết lập biến môi trường
Mặc định hệ thống không yêu cầu thiết lập `.env` vì bạn có thể điền mã API ngay trên `Control Panel`. Tuy nhiên, nếu muốn thiết lập cứng để khỏi phải nhập lại khi Restart Server, bạn có thể tạo một file `.env` chứa 3 keys:
```env
GROQ_API_KEY_1=gsk_...
GROQ_API_KEY_2=gsk_...
GROQ_API_KEY_3=gsk_...
```

Dự án được xây dựng bằng **Next.js**, **Socket.IO** và **TailwindCSS**. Chúc bạn có những phiên Live cháy nổ!
