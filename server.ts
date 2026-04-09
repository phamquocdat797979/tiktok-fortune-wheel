import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { startSpinWorker, globalEventBus } from './workers/spinWorker';
import { WebcastPushConnection } from 'tiktok-live-connector'; 
import { spinQueue, MOCK_QUEUE } from './lib/queue';
import { calculateAstrology } from './lib/astrology';

let tiktokConnection: WebcastPushConnection | null = null;

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Live User State cho Priority Queue
export const liveUserState: Record<string, {
  totalCoins: number;
  likes: number;
  isShared: boolean;
  lastSpunAt: number; // Cooldown tracking
}> = {};

// Theo dõi người dùng đang nằm trong hàng tự chọn HOẶC đang quay (Active Ticket)
const activeTickets = new Set<string>();

// Regex khớp: DD/MM/YYYY, DD/MM, MM/YYYY, hoặc YYYY (chỉ lấy 19xx hoặc 20xx)
const DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}|\d{1,2}\/\d{4}|(19|20)\d{2})\b/;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: { 
      origin: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_API_URL : "*",
      methods: ["GET", "POST"]
    }
  });

  const CHAT_LOGS: any[] = []; // Lưu trữ log trên RAM Server liên tục

  // Helper: gửi trạng thái hàng đợi cho tất cả client
  const emitQueueUpdate = (target: any) => {
    const preview = MOCK_QUEUE.slice(0, 5).map((d, i) => ({
      position: i + 1,
      nickname: d.nickname,
      priority: d.priority || 0,
    }));
    target.emit('queue_update', { count: MOCK_QUEUE.length, preview });
  };

  io.on('connection', (socket) => {
    console.log('OBS Screen connected:', socket.id);
    // Gửi ngay trạng thái hiện tại khi client mới join
    emitQueueUpdate(socket);
    socket.emit('valid_chat_history', CHAT_LOGS);
    
    // Helpers defined in connection scope for access by all handlers
    const getUserState = (uniqueId: string) => {
      if (!liveUserState[uniqueId]) {
        liveUserState[uniqueId] = { totalCoins: 0, likes: 0, isShared: false, lastSpunAt: 0 };
      }
      return liveUserState[uniqueId];
    };

    const updatePriorityInQueue = (uniqueId: string, state: any) => {
       let priority = 0;
       if (state.totalCoins > 0) priority = 1000000 + state.totalCoins;
       else if (state.isShared) priority = 100000;
       else if (state.likes >= 20) priority = 50000 + state.likes;

       const existingJobIndex = MOCK_QUEUE.findIndex(job => job.uniqueId === uniqueId);
       if (existingJobIndex > -1) {
           MOCK_QUEUE[existingJobIndex].priority = priority;
           MOCK_QUEUE.sort((a, b) => (b.priority || 0) - (a.priority || 0));
           emitQueueUpdate(io);
       }
       return priority;
    };

    socket.on('spin_completed', (data) => {
       globalEventBus.emit('spin_completed', data);
       io.emit('hide_popup', data);
       setTimeout(() => emitQueueUpdate(io), 100);
       
       // Xử lý Cooldown và Giải phóng vé khi hoàn tất vòng quay
       if (data && data.donor && data.donor.uniqueId) {
          const username = data.donor.uniqueId;
          const state = getUserState(username);
          state.lastSpunAt = Date.now();
          activeTickets.delete(username); // Giải phóng vé để họ có thể bình luận/test sau 5 phút
          console.log(`[Cooldown] Đã cập nhật cho @${username} và giải phóng active ticket lúc ${new Date().toLocaleTimeString()}`);
       }
    });

    // Relay lệnh phát giọng nói từ Screen sang Control Panel (để đồng bộ hóa hình/tiếng)
    socket.on('request_tts_play', (data) => {
       io.emit('start_tts_play', data);
    });
    
    socket.on('mock_inject_gift', (data) => {
      const { nickname = 'Admin_Test', dobString = '01/01/2000' } = data;
      const uniqueId = nickname; 
      const userId = `mock_${Math.random().toString(36).substr(2, 9)}`;
      
      const state = getUserState(uniqueId);
      
      // 1. KIỂM TRA ĐANG QUAY HOẶC TRONG HÀNG ĐỢI
      if (activeTickets.has(uniqueId)) {
          console.log(`[Mock Blocked] @${uniqueId} đã có vé hoặc đang quay!`);
          socket.emit('tiktok_status', { status: 'error', error: `[TEST] @${uniqueId} đã có vé hoặc đang quay!` });
          return;
      }

      // 2. KIỂM TRA COOLDOWN 5 PHÚT
      if (Date.now() - state.lastSpunAt < 300000) {
         const remaining = Math.ceil((300000 - (Date.now() - state.lastSpunAt)) / 1000);
         console.log(`[Mock Blocked] @${uniqueId} đang cooldown (${remaining}s)`);
         socket.emit('tiktok_status', { status: 'error', error: `[TEST] @${uniqueId} đang cooldown. Còn ${remaining} giây.` });
         return; 
      }

      const astroData = calculateAstrology(dobString);
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1; // 1-12
      const curDay = now.getDate();
      
      // KIỂM TRA NGÀY SINH TƯƠNG LAI (CHÍNH XÁC ĐẾN NGÀY/THÁNG)
      const parts = dobString.split(/[^0-9]/).filter((p: string) => p !== '');
      let inFuture = false;
      let reason = "";

      if (parts.length === 1) { // YYYY
          const y = parseInt(parts[0], 10);
          if (y > curYear) { inFuture = true; reason = `Năm ${y} > Năm hiện tại ${curYear}`; }
      } else if (parts.length === 2 && parseInt(parts[1], 10) > 31) { // MM/YYYY
          const m = parseInt(parts[0], 10);
          const y = parseInt(parts[1], 10);
          if (y > curYear) { inFuture = true; reason = `Năm ${y} > ${curYear}`; }
          else if (y === curYear && m > curMonth) { inFuture = true; reason = `Tháng ${m}/${y} > hiện tại`; }
      } else if (parts.length >= 3) { // DD/MM/YYYY
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          if (y > curYear) inFuture = true;
          else if (y === curYear && m > curMonth) inFuture = true;
          else if (y === curYear && m === curMonth && d > curDay) inFuture = true;
          if (inFuture) reason = `Ngày ${d}/${m}/${y} chưa tới (hôm nay là ${curDay}/${curMonth}/${curYear})`;
      }

      if (inFuture) {
          console.log(`[Mock Blocked] @${uniqueId} nhập ngày tương lai: ${reason}`);
          socket.emit('tiktok_status', { status: 'error', error: `[LỖI] Ngày sinh không được vượt quá hiện tại: ${reason}` });
          return;
      }
      
      if (!astroData.conGiap && !astroData.cungHoangDao) {
         socket.emit('tiktok_status', { status: 'error', error: `[LỖI] Dữ liệu ngày sinh không hợp lệ hoặc ngoài phạm vi bộ nhớ Wiki (Cung/Giáp): ${dobString}` });
         return;
      }

      // GHI LOG VÀO LỊCH SỬ DUYỆT (Giống chat thật)
      const logItem = {
         nickname: `[TEST] ${nickname}`,
         comment: `Bắn test: ${dobString}`,
         dobString: dobString,
         time: Date.now()
      };
      CHAT_LOGS.unshift(logItem);
      if (CHAT_LOGS.length > 50) CHAT_LOGS.pop();
      io.emit('valid_chat_log', logItem);

      const donorData = { userId, uniqueId, nickname, dobString, priority: 999999 };
      
      // Add ticket
      activeTickets.add(uniqueId);
      spinQueue.add('spin-job', donorData);
      
      emitQueueUpdate(io);
      console.log(`[Mock Inject] Đã thêm ${nickname} (@${uniqueId}) vào hàng đợi thành công.`);
    });

    socket.on('connect_tiktok', (data) => {
      const targetLive = data.username;
      if (!targetLive) {
         socket.emit('tiktok_status', { status: 'error', error: 'Vui lòng nhập Username TikTok!' });
         return;
      }

      console.log(`[TikTok] Bắt đầu kết nối với room: @${targetLive}`);
      io.emit('tiktok_status', { status: 'connecting', username: targetLive });

      if (tiktokConnection) {
         try { tiktokConnection.disconnect(); } catch (e) {}
         tiktokConnection = null;
      }

      try {
        tiktokConnection = new WebcastPushConnection(targetLive, {
          processInitialData: false,
          enableExtendedGiftInfo: true,
          enableWebsocketUpgrade: true,
          requestPollingIntervalMs: 2000
        });

        tiktokConnection.connect().then(state => {
            console.log(`[TikTok] Kết nối THÀNH CÔNG tới @${targetLive}`);
            io.emit('tiktok_status', { status: 'connected', username: targetLive });
        }).catch(err => {
            console.error(`[TikTok] Kết nối THẤT BẠI:`, err);
            io.emit('tiktok_status', { status: 'error', error: err.toString() });
        });

        tiktokConnection.on('disconnected', () => {
            console.log('[TikTok] Đã bị ngắt kết nối khỏi phòng Live.');
            io.emit('tiktok_status', { status: 'disconnected' });
        });

        tiktokConnection.on('error', err => {
            console.error('[TikTok Error]', err);
        });

        // Bắt sự kiện Quà
        tiktokConnection.on('gift', data => {
          if (data.giftType === 1 && !data.repeatEnd) return;
          const totalCoins = (data.diamondCount || 1) * (data.repeatCount || 1);
          const uniqueId = data.uniqueId;
          const state = getUserState(uniqueId);
          state.totalCoins += totalCoins;
          updatePriorityInQueue(uniqueId, state);
          console.log(`[TikTok Gift] ${data.nickname} (@${uniqueId}) tặng ${totalCoins} Xu! Total: ${state.totalCoins}`);
        });

        // Bắt sự kiện Share
        tiktokConnection.on('share', data => {
           const uniqueId = data.uniqueId;
           const state = getUserState(uniqueId);
           state.isShared = true;
           updatePriorityInQueue(uniqueId, state);
        });

        // Bắt sự kiện Like
        tiktokConnection.on('like', data => {
           const uniqueId = data.uniqueId;
           const state = getUserState(uniqueId);
           state.likes += data.likeCount;
           updatePriorityInQueue(uniqueId, state);
        });

        // Bắt sự kiện Chat - Regex ngày sinh
        tiktokConnection.on('chat', data => {
            const comment = data.comment;
            const match = comment.match(DATE_REGEX);
            if (match) {
                const dobString = match[0];
                
                // KIỂM TRA TRÙNG LẶP & COOLDOWN XONG -> KIỂM TRA NGÀY SINH CÓ TRONG TƯƠNG LAI KHÔNG
                const testAstro = calculateAstrology(dobString);
                if (!testAstro.conGiap && !testAstro.cungHoangDao) return;

                const now = new Date();
                const curYear = now.getFullYear();
                const curMonth = now.getMonth() + 1;
                const curDay = now.getDate();
                const parts = dobString.split(/[^0-9]/).filter((p: string) => p !== '');
                let inFuture = false;

                if (parts.length === 1) { // YYYY
                    if (parseInt(parts[0], 10) > curYear) inFuture = true;
                } else if (parts.length === 2 && parseInt(parts[1], 10) > 31) { // MM/YYYY
                    const m = parseInt(parts[0], 10);
                    const y = parseInt(parts[1], 10);
                    if (y > curYear || (y === curYear && m > curMonth)) inFuture = true;
                } else if (parts.length >= 3) { // DD/MM/YYYY
                    const d = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const y = parseInt(parts[2], 10);
                    if (y > curYear || (y === curYear && m > curMonth) || (y === curYear && m === curMonth && d > curDay)) inFuture = true;
                }

                if (inFuture) {
                   console.log(`[Chat Blocked] @${data.uniqueId} nhập ngày tương lai: ${dobString}`);
                   return;
                }

                const uniqueId = data.uniqueId;
                const state = getUserState(uniqueId);

                // 1. KIỂM TRA ĐANG CÓ VÉ / ĐANG QUAY
                if (activeTickets.has(uniqueId)) {
                   console.log(`[Chat Blocked] @${uniqueId} đã có vé hoặc đang quay!`);
                   return;
                }

                // 2. KIỂM TRA COOLDOWN: 5 phút = 300000ms
                if (Date.now() - state.lastSpunAt < 300000) {
                   const remaining = Math.ceil((300000 - (Date.now() - state.lastSpunAt)) / 1000);
                   console.log(`[Chat Blocked] @${uniqueId} đang cooldown (${remaining}s)`);
                   return; // Chặn spam sau khi vừa được gọi
                }

                // Bắn log lên Control Panel
                const logItem = {
                   nickname: data.nickname || 'Viewer',
                   comment: comment,
                   dobString: dobString,
                   time: Date.now()
                };
                CHAT_LOGS.unshift(logItem);
                if (CHAT_LOGS.length > 50) CHAT_LOGS.pop();
                io.emit('valid_chat_log', logItem);

                let priority = 0;
                if (state.totalCoins > 0) priority = 1000000 + state.totalCoins;
                else if (state.isShared) priority = 100000;
                else if (state.likes >= 20) priority = 50000 + state.likes;

                // LIMIT: Hàng đợi rác
                if (MOCK_QUEUE.length > 100 && priority === 0) {
                   return; // Chặn comment thường nếu nghẽn
                }

                const donorData = {
                  userId: data.userId.toString(),
                  uniqueId,
                  nickname: data.nickname || 'Viewer',
                  dobString,
                  priority
                };

                activeTickets.add(uniqueId); // Kích hoạt vé active
                spinQueue.add('spin-job', donorData);
                console.log(`[Queue] Added @${uniqueId} - DOB: ${dobString} - Priority: ${priority}`);
                emitQueueUpdate(io);
            }
        });

      } catch (e: any) {
         console.error('[TikTok Exception]', e);
         io.emit('tiktok_status', { status: 'error', error: e.toString() });
      }
    });

    socket.on('disconnect_tiktok', () => {
      if (tiktokConnection) {
        console.log('[TikTok] Yêu cầu đóng Live Connection từ Admin Panel.');
        try { tiktokConnection.disconnect(); } catch (e) {}
        tiktokConnection = null;
      }
      io.emit('tiktok_status', { status: 'disconnected' });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  startSpinWorker(io);

  httpServer.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
