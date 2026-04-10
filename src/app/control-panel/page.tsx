'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const TRACKS = [
  { id: 1, name: 'Despair', file: 'Despair - Looked At Her For _ Limitless (Despair) - SeVen.13.mp3', emoji: '😢' },
  { id: 2, name: 'For Your Future', file: 'For Your Future.mp3', emoji: '🌟' },
  { id: 3, name: 'Star Sky', file: 'Two Steps From Hell - Star Sky (Zoru Beat Remix).mp3', emoji: '🚀' },
];

export default function ControlPanel() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [injectStatus, setInjectStatus] = useState<string>('');
  
  // Data for mock injection
  const [nickname, setNickname] = useState<string>('TestUser');
  const [dobString, setDobString] = useState<string>('15/08/1995');
  
  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(70);
  const [musicProgress, setMusicProgress] = useState<number>(0);
  const [musicDuration, setMusicDuration] = useState<number>(0);

  // Queue State
  const [queuePreview, setQueuePreview] = useState<{ position: number; nickname: string; priority: number }[]>([]);
  const [queueCount, setQueueCount] = useState(0);

  // Valid Chat Logs (Lịch sử duyệt comment)
  const [validChats, setValidChats] = useState<{nickname: string; comment: string; dobString: string; time: number}[]>([]);

  // TikTok Live States
  const [tiktokUsername, setTiktokUsername] = useState<string>('');
  const [tiktokStatus, setTiktokStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [tiktokError, setTiktokError] = useState<string>('');
  
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
    
    // Giảm nhạc nền + chờ để TTS phát
    s.on('start_spin', () => {
        if (musicAudioRef.current) {
            musicAudioRef.current.volume = 0.15;
        }
    });

    // Phục hồi nhạc nền sau khi đọc xong
    s.on('hide_popup', () => {
        if (musicAudioRef.current) {
            musicAudioRef.current.volume = musicVolume / 100;
        }
    });

    // ⭐ TTS ĐỒNG BỘ: Đợi Screen phát lệnh 'start_tts_play' (sau khi vòng quay dừng) rồi mới đọc
    s.on('start_tts_play', (data: any) => {
        if (!data.fortuneText) return;
        const jobId = data.jobId;
        const donor = data.donor;
        console.log('[Control Panel TTS] Được lệnh phát đồng bộ:', data.fortuneText.substring(0, 50) + '...');
        
        fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.fortuneText })
        })
        .then(res => res.json())
        .then(resData => {
            const chunks = resData.chunks;
            if (!chunks || chunks.length === 0) {
                console.warn('[Control Panel TTS] API không trả về audio:', resData);
                s.emit('spin_completed', { jobId, donor });
                return;
            }
            console.log(`[Control Panel TTS] Phát ${chunks.length} chunk(s)...`);
            if (musicAudioRef.current) musicAudioRef.current.volume = 0.15;
            let idx = 0;
            const playNext = () => {
                if (idx >= chunks.length) { 
                    console.log('[Control Panel TTS] Đọc xong! Emit spin_completed.');
                    s.emit('spin_completed', { jobId, donor });
                    if (musicAudioRef.current) musicAudioRef.current.volume = musicVolume / 100;
                    return;
                }
                const audio = new Audio('data:audio/mp3;base64,' + chunks[idx].base64);
                audio.playbackRate = 1.3; 
                if ('preservesPitch' in audio) (audio as any).preservesPitch = true;
                audio.onended = () => { idx++; playNext(); };
                audio.onerror  = () => { idx++; playNext(); };
                audio.play().catch(e => {
                    console.error('[Control Panel TTS] Lỗi play:', e);
                    idx++; playNext();
                });
            };
            playNext();
        })
        .catch(err => {
            console.error('[Control Panel TTS] Fetch error:', err);
            s.emit('spin_completed', { jobId, donor }); 
        });
    });

    s.on('tiktok_status', (payload) => {
        setTiktokStatus(payload.status);
        if (payload.status === 'error') {
            setTiktokError(payload.error || 'Lỗi không xác định');
        } else {
            setTiktokError('');
        }
    });

    s.on('queue_update', (data: any) => {
        setQueueCount(data.count || 0);
        setQueuePreview(data.preview || []);
    });

    s.on('valid_chat_log', (log: any) => {
        setValidChats(prev => [log, ...prev].slice(0, 50)); // Lưu tối đa 50 lịch sử gần nhất
    });

    s.on('valid_chat_history', (logs: any[]) => {
        setValidChats(logs); // Nạp đống lịch sử cũ từ Nodejs qua khi vừa kết nối
    });

    s.on('llm_status', (data: any) => {
        setLlmStatus(data);
    });

    s.on('llm_ping_result', (data: any) => {
        setLlmPingResult(data);
        setIsPinging(false);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [musicVolume]);

  const [llmStatus, setLlmStatus] = useState<{ status: 'ready' | 'missing', keyPreview: string | null }>({ status: 'missing', keyPreview: null });
  const [llmPingResult, setLlmPingResult] = useState<{ success?: boolean, message?: string, preview?: string, error?: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const testInjectMock = async () => {
    if (!socket) return;
    setInjectStatus('Đang gửi...');
    try {
      socket.emit('mock_inject_gift', { nickname, dobString });
      setInjectStatus(`✅ Bắn thành công cho ${nickname} (Ngày: ${dobString})`);
    } catch (err: any) {
      setInjectStatus('❌ Lỗi kết nối: ' + err.message);
    }
  };

  const handleConnectTikTok = () => {
    if (!socket || !tiktokUsername.trim()) return;
    setTiktokError('');
    socket.emit('connect_tiktok', { username: tiktokUsername.replace('@', '').trim() });
  };

  const handleDisconnectTikTok = () => {
    if (!socket) return;
    socket.emit('disconnect_tiktok');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">🎮 Admin Control Panel - Sinh Thần Vận Mệnh</h1>

        <div className="grid grid-cols-2 gap-4">
          {/* ===== CỘT TRÁI ===== */}
          <div className="flex flex-col gap-4">

            {/* TikTok Live */}
            <div className="border-[2px] border-emerald-500/30 rounded-xl p-4 bg-emerald-50/50 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-emerald-800 flex items-center gap-2">📱 Kết Nối TikTok Live</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase text-white ${
                  tiktokStatus === 'connected' ? 'bg-emerald-500' :
                  tiktokStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                  tiktokStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'
                }`}>
                  {tiktokStatus === 'connected' && '🟢 Đang Live'}
                  {tiktokStatus === 'connecting' && '🟡 Đang kết nối...'}
                  {tiktokStatus === 'error' && '🔴 Lỗi'}
                  {tiktokStatus === 'disconnected' && '⚪ Ngắt kết nối'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-slate-400 bg-white h-10 px-3 rounded-lg border border-slate-200 flex items-center">@</span>
                <input
                  type="text"
                  className="flex-1 h-10 px-3 rounded-lg border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nhập ID TikTok (Ví dụ: tuansi25)"
                  value={tiktokUsername}
                  onChange={e => setTiktokUsername(e.target.value)}
                  disabled={tiktokStatus === 'connected' || tiktokStatus === 'connecting'}
                />
              </div>
              {tiktokError && <div className="text-red-500 text-xs mb-2 bg-red-50 p-2 rounded-lg border border-red-200">{tiktokError}</div>}
              <div className="flex gap-2 mt-2">
                {tiktokStatus !== 'connected' ? (
                  <button onClick={handleConnectTikTok} disabled={tiktokStatus === 'connecting' || !tiktokUsername.trim()}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm">
                    {tiktokStatus === 'connecting' ? 'Đang kết nối...' : '▶ Bắt Đầu Livestream'}
                  </button>
                ) : (
                  <button onClick={handleDisconnectTikTok}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm">
                    ⏹ Ngừng Lấy Dữ Liệu
                  </button>
                )}
              </div>
            </div>

            {/* Mô phỏng Input (Test chức năng AI) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-sm">
              <h2 className="text-base font-semibold mb-3 text-slate-700">🔮 Bắn Data Test Trực Tiếp (Admin Ưu Tiên)</h2>
              <div className="flex flex-col gap-3 mb-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Tên người xem</label>
                   <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                     className="w-full border p-2 rounded-lg text-black text-sm" placeholder="VD: Cô Gái Năm Ấy" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Ngày sinh (DD/MM/YYYY hoặc YYYY)</label>
                   <input type="text" value={dobString} onChange={e => setDobString(e.target.value)}
                     className="w-full border p-2 rounded-lg text-black text-sm" placeholder="15/08/1995" />
                </div>
              </div>
              <button onClick={testInjectMock}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                🚀 Cầu Mệnh Test Ưu Tiên
              </button>
              {injectStatus && <div className="mt-2 p-2 bg-slate-200 text-slate-800 rounded text-xs text-center">{injectStatus}</div>}
            </div>

            {/* Panel Hàng Đợi (Dành cho bản thân người live kiểm soát) */}
            <div className="border-[2px] border-emerald-400/40 rounded-xl p-4 bg-emerald-50/60 shadow-sm">
              <h2 className="text-base font-bold text-emerald-800 mb-3 flex items-center justify-between">
                 <span className="flex items-center gap-2">⏳ Hàng Đợi Hiện Tại</span>
                 <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded text-xs">{queueCount} người</span>
              </h2>
              <div className="flex flex-col gap-2">
                 {queueCount === 0 ? (
                    <div className="text-slate-500 italic text-sm text-center py-2 border border-dashed border-slate-300 rounded">Chưa có ai chờ</div>
                 ) : (
                    queuePreview.map((person, idx) => (
                       <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded shadow-sm border border-emerald-100">
                          <span className="font-bold text-slate-700">#{person.position}. {person.nickname}</span>
                          {person.priority > 0 && <span className="text-amber-600 font-bold text-xs">{person.priority >= 1000000 ? ' VIP' : person.priority >= 100000 ? ' Share' : ' Tim'}</span>}
                       </div>
                    ))
                 )}
                 {queueCount > 5 && (
                    <div className="text-center text-xs text-slate-500 mt-1 italic">...và {queueCount - 5} người khác nữa</div>
                 )}
              </div>
            </div>

            {/* Lịch sử bình luận duyệt thành công */}
            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/60 shadow-sm mt-4">
              <h2 className="text-base font-bold text-indigo-800 mb-3 flex items-center gap-2">✅ Lịch Sử Duyệt (50 gần nhất)</h2>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                 {validChats.length === 0 ? (
                     <div className="text-slate-500 italic text-sm text-center py-2 border border-dashed border-slate-300 rounded">Chưa có bình luận qua bộ lọc</div>
                 ) : (
                     validChats.map((chat, idx) => (
                         <div key={idx} className="bg-white p-2.5 rounded shadow-sm border border-indigo-100 flex flex-col gap-1">
                             <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{chat.nickname}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">{new Date(chat.time).toLocaleTimeString('vi-VN')}</span>
                             </div>
                             <span className="text-xs text-slate-500">Cmt: <span className="text-slate-700">"{chat.comment}"</span></span>
                             <span className="text-[13px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded w-fit mt-0.5">🗓️ Lấy ngày: {chat.dobString}</span>
                         </div>
                     ))
                 )}
              </div>
            </div>

          </div>

          {/* ===== CỘT PHẢI ===== */}
          <div className="flex flex-col gap-4">

            {/* Quản lý Dữ liệu Tử Vi (RAG) */}
            <div className="border-[2px] border-blue-400/40 rounded-xl p-4 bg-blue-50/60 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-blue-800 flex items-center gap-2">📚 Trí Tuệ Nhân Tạo (Groq AI)</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                  llmStatus.status === 'ready' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}>
                  {llmStatus.status === 'ready' ? `🟢 AI Sẵn Sàng (${llmStatus.keyPreview})` : '🔴 AI Chưa Nạp Key'}
                </span>
              </div>
              <div className="flex flex-col gap-2 relative">
                <div className="flex gap-2">
                  <button 
                    disabled={isPinging || !socket}
                    onClick={() => { setIsPinging(true); socket?.emit('ping_llm'); }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2 rounded-lg text-sm transition-all shadow"
                  >
                    {isPinging ? '⏳ Đang thử...' : '🔍 Kiểm Tra API'}
                  </button>
                  <button 
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerText = '⏳ Đang quét dữ liệu...';
                      try {
                        const res = await fetch('/api/admin/daily-update', { method: 'POST' });
                        const json = await res.json();
                        if (json.success) {
                          btn.innerText = '✅ ' + json.message;
                          setTimeout(() => { btn.innerText = '🔄 Cập Nhật Wiki'; btn.disabled = false; }, 3000);
                        } else {
                          btn.innerText = '❌ Lỗi: ' + json.error;
                          setTimeout(() => { btn.innerText = '🔄 Cập Nhật Wiki'; btn.disabled = false; }, 3000);
                        }
                      } catch (err: any) {
                        btn.innerText = '❌ Lỗi server';
                        setTimeout(() => { btn.innerText = '🔄 Cập Nhật Wiki'; btn.disabled = false; }, 3000);
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow"
                  >
                    🔄 Cập Nhật Wiki
                  </button>
                </div>

                {llmPingResult && (
                  <div className={`text-[11px] p-2 rounded border ${
                    llmPingResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                    {llmPingResult.success ? (
                      <div>
                        <strong>✅ Kết nối OK!</strong> Groq đã phản hồi: 
                        <em className="block mt-1 opacity-70">"{llmPingResult.preview}"</em>
                      </div>
                    ) : (
                      <div>
                        <strong>❌ Lỗi:</strong> {llmPingResult.error}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-blue-600/80 bg-blue-100 p-2 rounded text-justify">
                  <strong>RAG Mode:</strong> Khi ấn nút này, Bot sẽ tự động lấy dữ liệu tử vi cho ngày hôm nay từ các nguồn uy tín, ghi đè vào hệ thống (Daily Wiki). Groq AI sẽ đọc các file này kết hợp với Cung/Mạng năm sinh tĩnh khi bói cho người xem!
                </div>
              </div>
            </div>

            {/* Nhạc nền */}
            <div className="border-[2px] border-purple-400/40 rounded-xl p-4 bg-purple-50/60 shadow-sm">
              <h2 className="text-base font-bold text-purple-800 mb-3 flex items-center gap-2">🎵 Nhạc Nền Game</h2>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {TRACKS.map(track => (
                  <button key={track.id}
                    onClick={() => setSelectedTrack(track.id)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 font-semibold transition-all text-center text-xs ${
                      selectedTrack === track.id
                        ? 'border-purple-500 bg-purple-100 text-purple-900 shadow-md'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-purple-300'
                    }`}>
                    <span className="text-2xl">{track.emoji}</span>
                    <span className="leading-tight">{track.name}</span>
                    {selectedTrack === track.id && isMusicPlaying && <span className="text-purple-500 animate-pulse text-[10px]">▶ đang phát</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-slate-500 text-xs w-14">🔊 Vol</span>
                <input type="range" min={0} max={100} value={musicVolume}
                  onChange={e => {
                    const vol = Number(e.target.value);
                    setMusicVolume(vol);
                    if (musicAudioRef.current) musicAudioRef.current.volume = vol / 100;
                  }}
                  className="flex-1 accent-purple-500" />
                <span className="text-slate-700 font-bold text-xs w-8 text-right">{musicVolume}%</span>
              </div>

              {/* Thanh thời gian */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-mono">
                  <span>{new Date(musicProgress * 1000).toISOString().substr(14, 5)}</span>
                  <span>{new Date(musicDuration * 1000).toISOString().substr(14, 5)}</span>
                </div>
                <input 
                  type="range" min={0} max={musicDuration || 0} value={musicProgress}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setMusicProgress(val);
                    if (musicAudioRef.current) musicAudioRef.current.currentTime = val;
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => {
                  const track = TRACKS.find(t => t.id === selectedTrack)!;
                  if (!musicAudioRef.current) {
                    const audio = new Audio('/' + track.file);
                    audio.loop = true;
                    audio.ontimeupdate = () => setMusicProgress(audio.currentTime);
                    audio.onloadedmetadata = () => setMusicDuration(audio.duration);
                    musicAudioRef.current = audio;
                  } else {
                    if (musicAudioRef.current.src.indexOf(encodeURI(track.file)) === -1) {
                         musicAudioRef.current.src = '/' + track.file;
                    }
                  }
                  musicAudioRef.current.volume = musicVolume / 100;
                  musicAudioRef.current.play().catch(e => console.error("Play error:", e));
                  setIsMusicPlaying(true);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-sm transition-all">▶ Phát</button>
                <button onClick={() => { 
                  if (musicAudioRef.current) musicAudioRef.current.pause();
                  setIsMusicPlaying(false); 
                }}
                className="flex-1 bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 rounded-lg text-sm transition-all">⏸ Dừng</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
