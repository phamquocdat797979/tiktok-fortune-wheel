'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lunar, Solar } from 'lunar-javascript';

const TRACKS = [
  { id: 1, name: 'Despair', file: 'Despair - Looked At Her For _ Limitless (Despair) - SeVen.13.mp3', emoji: '😢' },
  { id: 2, name: 'For Your Future', file: 'For Your Future.mp3', emoji: '🌟' },
  { id: 3, name: 'Star Sky', file: 'Two Steps From Hell - Star Sky (Zoru Beat Remix).mp3', emoji: '🚀' },
];

const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

const getLunarVN = (date: Date) => {
  try {
    const lunar = Lunar.fromDate(date);
    const y = lunar.getYear();
    const can = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'][y % 10];
    const chi = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'][y % 12];
    const aN = String(lunar.getDay()).padStart(2, '0');
    const aT = String(lunar.getMonth()).padStart(2, '0');
    return `${aN}/${aT}/${y} (${can} ${chi})`;
  } catch(e) { return ''; }
};

const getSolarVN = (date: Date) => {
  const hN = String(date.getDate()).padStart(2, '0');
  const hT = String(date.getMonth() + 1).padStart(2, '0');
  const hNyo = date.getFullYear();
  return `${hN}/${hT}/${hNyo}`;
};

export default function ControlPanel() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [injectStatus, setInjectStatus] = useState<string>('');
  const [now, setNow] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Data for mock injection
  const [nickname, setNickname] = useState<string>('TestUser');
  const [dobString, setDobString] = useState<string>('15/08/1995');
  
  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(70);
  // Sync ref mỗi khi state thay đổi
  useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);
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
  // Ref luôn trỏ tới giá trị volume mới nhất (tránh closure cũ bên trong useEffect)
  const musicVolumeRef = useRef<number>(70);

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
            musicAudioRef.current.volume = musicVolumeRef.current / 100;
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
                    if (musicAudioRef.current) musicAudioRef.current.volume = musicVolumeRef.current / 100;
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

    s.on('llm_stats_update', (data: any) => {
        setLlmStats(data);
    });

    s.on('wiki_auto_updated', (data: any) => {
        setWikiAutoMsg(data);
        // Tự ẩn sau 10 giây
        setTimeout(() => setWikiAutoMsg(null), 10000);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [musicVolume]);

  const [llmStatus, setLlmStatus] = useState<{ status: 'ready' | 'missing', keyCount?: number, keyPreview: string | null }>({ status: 'missing', keyPreview: null });
  const [llmPingResult, setLlmPingResult] = useState<{ success?: boolean, message?: string, preview?: string, error?: string } | null>(null);
  const [llmStats, setLlmStats] = useState<{ totalTokensUsed: number, lastUsage?: any, limits?: any, totalKeys?: number } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [wikiAutoMsg, setWikiAutoMsg] = useState<{ message: string; time: string } | null>(null);

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

  const [activeTab, setActiveTab] = useState<'live' | 'system'>('live');

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070912] text-slate-300 font-sans relative flex flex-col">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#070912] to-black pointer-events-none"></div>
      
      {/* HEADER & TABS NAVIGATION */}
      <div className="relative z-10 flex items-center justify-between px-6 lg:px-8 py-5 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300 tracking-tight">
              🎮 Sinh Thần Vận Mệnh
            </h1>
            <p className="text-[11px] text-slate-500 font-medium mt-1 tracking-wider uppercase">Control Panel v2.0</p>
          </div>
          
          <div className="h-10 w-px bg-white/10 mx-2"></div>
          
          {/* Tabs */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'live' 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={activeTab === 'live' ? 'animate-pulse' : ''}>🔴</span> Giám Sát Live
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'system' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              ⚙️ Hệ Thống
            </button>
          </div>
        </div>
        
        {/* Quick Status Minibar & Date */}
        <div className="flex items-center gap-4">
            {mounted ? (
              <div className="flex items-center gap-3 mr-2 hidden lg:flex">
                <span className="text-2xl font-black text-amber-300 tracking-tight drop-shadow-md">
                  {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-sm text-slate-200 font-bold whitespace-nowrap bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 uppercase flex items-center gap-2">
                  <span className="text-amber-400">☀️</span> Dương Lịch: <span className="text-white">{getSolarVN(now)}</span>
                </span>
                <span className="text-sm text-amber-200 font-bold whitespace-nowrap bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 uppercase flex items-center gap-2">
                  <span className="text-indigo-300">🌙</span> Âm Lịch: <span className="text-amber-100 italic">{getLunarVN(now)}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 mr-2 hidden lg:flex opacity-0">
                <span className="text-2xl font-black tracking-tight drop-shadow-md">00:00:00</span>
                <span className="text-sm font-bold bg-black/40 px-3 py-1.5 rounded-lg">Đang tải...</span>
              </div>
            )}
            
            <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-bold ${tiktokStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-white/5 text-slate-500'}`}>
               <span className="text-sm">📱</span> {tiktokStatus === 'connected' ? 'TikTok: Đang lấy data' : 'TikTok: Tắt'}
            </div>
            <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-bold ${llmStatus.status === 'ready' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
               <span className="text-sm">🧠</span> {llmStatus.status === 'ready' ? 'AI: Online' : 'AI: Offline'}
            </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="relative z-10 flex-1 overflow-hidden p-6 lg:p-8 flex flex-col">
        
        {/* ===================== TAB 1: LIVE MONITOR ===================== */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-[fadeScaleIn_0.3s_ease-out_forwards]">
            
            {/* Cột Trái: Cấu hình nhanh Live (3/12) */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* TikTok Live */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden group shrink-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-emerald-300 flex items-center gap-2 tracking-wide uppercase">
                    📱 Kết Nối TikTok
                  </h2>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-bold text-slate-500 bg-black/30 h-10 px-3 rounded-xl border border-white/5 flex items-center">@</span>
                  <input
                    type="text"
                    className="flex-1 h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-600"
                    placeholder="ID TikTok (VD: tuan.dz)"
                    value={tiktokUsername}
                    onChange={e => setTiktokUsername(e.target.value)}
                    disabled={tiktokStatus === 'connected' || tiktokStatus === 'connecting'}
                  />
                </div>

                {tiktokError && <div className="text-rose-400 text-xs mb-3 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">{tiktokError}</div>}
                
                <div className="flex gap-2">
                  {tiktokStatus !== 'connected' ? (
                    <button onClick={handleConnectTikTok} disabled={tiktokStatus === 'connecting' || !tiktokUsername.trim()}
                      className="w-full relative overflow-hidden rounded-xl p-[1px] group/btn transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-70 group-hover/btn:opacity-100 transition-opacity"></span>
                      <div className="relative bg-slate-950 px-4 py-3 rounded-[11px] transition-all group-hover/btn:bg-transparent">
                        <span className="relative z-10 text-emerald-300 font-bold text-sm tracking-wide group-hover/btn:text-white transition-colors block text-center">
                          {tiktokStatus === 'connecting' ? 'Đang kết nối...' : '▶ Bắt Đầu Lắng Nghe'}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <button onClick={handleDisconnectTikTok}
                      className="w-full relative overflow-hidden rounded-xl p-[1px] group/btn transition-all flex-[1]">
                      <span className="absolute inset-0 bg-gradient-to-r from-rose-500 to-red-500 rounded-xl opacity-70 group-hover/btn:opacity-100 transition-opacity"></span>
                      <div className="relative bg-slate-950 px-4 py-3 rounded-[11px] transition-all group-hover/btn:bg-transparent">
                         <span className="relative z-10 text-rose-300 font-bold text-sm tracking-wide group-hover/btn:text-white transition-colors block text-center">
                          ⏹ Ngừng Thu Tập
                         </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Nhạc nền */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl relative group flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500 to-purple-500/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <h2 className="text-sm font-bold text-purple-300 mb-4 flex items-center gap-2 uppercase tracking-wide">🎵 Nhạc Nền Lan Toả</h2>
                
                <div className="flex flex-col gap-2 mb-4 pr-1 overflow-y-auto custom-scrollbar">
                  {TRACKS.map(track => (
                    <button key={track.id}
                      onClick={() => setSelectedTrack(track.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm shrink-0 ${
                        selectedTrack === track.id
                          ? 'border-purple-500/50 bg-purple-500/20 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : 'border-white/5 bg-black/20 text-slate-400 hover:border-white/20 hover:bg-white/5'
                      }`}>
                      <span className="text-xl">{track.emoji}</span>
                      <span className="font-medium text-left line-clamp-1">{track.name}</span>
                      {selectedTrack === track.id && isMusicPlaying && <span className="ml-auto text-purple-400 animate-[pulse_2s_ease-in-out_infinite] text-xs shrink-0">▶</span>}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 mb-5 bg-black/20 px-3 py-2.5 rounded-xl border border-white/5 shrink-0">
                  <span className="text-slate-400 text-[10px] font-bold">Âm lượng</span>
                  <input type="range" min={0} max={100} value={musicVolume}
                    onChange={e => {
                      const vol = Number(e.target.value);
                      setMusicVolume(vol);
                      if (musicAudioRef.current) musicAudioRef.current.volume = vol / 100;
                    }}
                    className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-purple-300 font-bold text-[10px] w-6 text-right cursor-default">{musicVolume}%</span>
                </div>

                <div className="mt-auto shrink-0">
                  <div className="flex justify-between text-[9px] text-slate-500 mb-2 font-mono">
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
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:h-1.5 transition-all mb-4 block" 
                  />
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
                    className="flex-[2] bg-purple-600/40 hover:bg-purple-600/70 border border-purple-500/40 text-purple-100 font-bold py-2.5 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)]">▶ Phát Nhạc</button>
                    
                    <button onClick={() => { 
                      if (musicAudioRef.current) musicAudioRef.current.pause();
                      setIsMusicPlaying(false); 
                    }}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-2.5 rounded-xl text-sm transition-all">⏸ Tạm Dừng</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cột Phải: Hàng đợi & Log (9/12) */}
            <div className="lg:col-span-9 relative min-h-[500px]">
              <div className="absolute inset-0 flex flex-col lg:flex-row gap-6">
               {/* Danh sách chờ khổng lồ */}
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col flex-[3] relative overflow-hidden group min-h-0">
                  <div className="absolute top-0 right-0 w-1/2 h-1 bg-gradient-to-l from-emerald-500/0 via-emerald-500 to-emerald-500/0 opacity-30 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                      ⏳ Danh Sách Hàng Đợi (Đang Ưu Tiên)
                    </h2>
                    <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-emerald-300 text-[11px] font-bold tracking-wide">{queueCount} người chờ</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
                    {queueCount === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                          <span className="text-5xl mb-4">🍃</span>
                          <span className="text-base font-medium">Hàng đợi đang trống. Sẵn sàng nhận lệnh!</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                          {queuePreview.map((person, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-all group/item">
                                <div className="flex items-center gap-4">
                                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${idx === 0 ? 'bg-gradient-to-br from-amber-300 to-orange-400 text-slate-900 shadow-[0_0_25px_rgba(251,191,36,0.5)] scale-110 border border-amber-200' : 'bg-slate-800/80 text-slate-400'}`}>
                                    {person.position}
                                  </span>
                                  <span className={`font-bold text-base transition-colors ${idx === 0 ? 'text-amber-300 text-lg' : 'text-slate-200 group-hover/item:text-white'}`}>{person.nickname}</span>
                                </div>
                                {person.priority > 0 && (
                                  <div className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider border shadow-sm ${person.priority >= 1000000 ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : person.priority >= 100 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-pink-500/20 text-pink-300 border-pink-500/30'}`}>
                                    {person.priority >= 1000000 ? `🎁 VIP XU (+${person.priority - 1000000})` : person.priority >= 100 ? '🔁 SHARE' : `❤️ ${person.priority} TIM`}
                                  </div>
                                )}
                            </div>
                          ))}
                          {queueCount > queuePreview.length && (
                              <div className="text-center text-sm text-slate-500 mt-2 py-4 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                                ...và <span className="font-bold text-slate-400 text-base">{queueCount - queuePreview.length}</span> người đang chờ phía sau
                              </div>
                          )}
                        </div>
                    )}
                  </div>
               </div>

               {/* Log lịch sử bên cạnh */}
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col flex-[2] relative min-h-0">
                  <div className="p-5 border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
                    <span className="text-indigo-400 text-lg">💬</span>
                    <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Log Lệnh Duyệt (Quá Khứ)</h2>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
                    {validChats.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-600 opacity-60 text-sm">
                          Chưa thu thập được dữ liệu...
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                          {validChats.map((chat, idx) => (
                              <div key={idx} className="bg-black/20 p-4 rounded-2xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                                  <div className="flex justify-between items-center mb-2.5">
                                      <span className="font-bold text-indigo-200 text-sm">{chat.nickname}</span>
                                      <span className="text-[9px] text-slate-500 font-mono tracking-wider bg-black/50 px-2 py-1 rounded-md border border-white/5">{new Date(chat.time).toLocaleTimeString('vi-VN')}</span>
                                  </div>
                                  <div className="text-[13px] text-slate-400 mb-3 bg-white/5 p-2 rounded-xl border border-white/5 italic">
                                    {chat.comment}
                                  </div>
                                  <div className="inline-flex items-center gap-2 text-[10px] text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl uppercase tracking-wide">
                                      <span className="text-indigo-400 text-base leading-none">⚡</span>
                                      Ngày Lọc Được: {chat.dobString}
                                  </div>
                              </div>
                          ))}
                        </div>
                    )}
                  </div>
               </div>
              </div>
            </div>

          </div>
        )}

        {/* ===================== TAB 2: SYSTEM & DEV ===================== */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0 animate-[fadeScaleIn_0.3s_ease-out_forwards] content-start overflow-y-auto custom-scrollbar pb-10">
            
            {/* Cột 1: Cấu hình Data & Mock */}
            <div className="flex flex-col gap-6">
              
              {/* Mô phỏng Input (Chuyển sang dev/system) */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative shrink-0">
                <h2 className="text-sm font-bold text-blue-300 mb-5 flex items-center gap-2 uppercase tracking-wide">
                  🛠 Công cụ giả lập bình luận (Chạy thử AI)
                </h2>
                <div className="flex flex-col lg:flex-row gap-4 mb-5">
                  <div className="flex-1">
                     <label className="text-[11px] font-bold text-slate-500 mb-2 block uppercase tracking-wider pl-1">Tên Người Chơi Giả Lập</label>
                     <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                       className="w-full bg-black/20 border border-white/10 p-3.5 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600" placeholder="VD: Khách V.I.P" />
                  </div>
                  <div className="flex-1">
                     <label className="text-[11px] font-bold text-slate-500 mb-2 block uppercase tracking-wider pl-1">Ngày Tháng Năm Sinh (Mẫu)</label>
                     <input type="text" value={dobString} onChange={e => setDobString(e.target.value)}
                       className="w-full bg-black/20 border border-white/10 p-3.5 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600" placeholder="VD: 15/08/1995" />
                  </div>
                </div>
                <button onClick={testInjectMock}
                  className="w-full bg-blue-600/20 hover:bg-blue-600/50 border border-blue-500/30 hover:border-blue-400 text-blue-300 hover:text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  🚀 Bắn tin nhắn giả lập vào Hàng Đợi (Test)
                </button>
                {injectStatus && <div className={`mt-4 p-3 rounded-xl text-xs text-center border ${injectStatus.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : injectStatus.includes('❌') ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{injectStatus}</div>}
              </div>

              {/* RAG Wiki */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative flex flex-col">
                <h2 className="text-sm font-bold text-amber-300 mb-5 flex items-center gap-2 uppercase tracking-wide shrink-0">
                  📚 Cơ Sở Dữ Liệu Trả Lời (Tử Vi Hàng Ngày)
                </h2>
                
                <div className="text-sm text-slate-400 leading-loose bg-black/20 rounded-2xl border border-white/5 p-5 mb-5 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                    <span className="font-medium text-slate-500">Nguồn trích xuất gốc:</span>
                    <span className="font-bold text-slate-300 select-all">lichngaytot.com</span>
                  </div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                    <span className="font-medium text-slate-500">Tự động cập nhật web lúc:</span>
                    <span className="font-bold text-amber-200 bg-amber-500/20 px-3 py-1 rounded-xl">6:00 Sáng VN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Lịch sử cập nhật gần nhất:</span>
                    {wikiAutoMsg ? (
                       <span className={`font-bold px-3 py-1 rounded-xl ${wikiAutoMsg.message.startsWith('✅') ? 'text-emerald-300 bg-emerald-500/20' : 'text-rose-300 bg-rose-500/20'}`}>{wikiAutoMsg.message.replace('✅ ', '').replace('❌ ', '')}</span>
                    ) : (
                       <span className="font-medium text-slate-600 italic">Chưa có log</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <p className="text-xs text-slate-500 text-center mb-3">Sử dụng nút biên dưới khi bạn cần ép server cào lại dữ liệu ngay lập tức.</p>
                  <button 
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerHTML = '<span class="animate-pulse flex justify-center items-center gap-2"><span class="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></span> Đang cào...</span>';
                      try {
                        const res = await fetch('/api/admin/daily-update', { method: 'POST' });
                        const json = await res.json();
                        if (json.success) {
                          btn.innerHTML = '✅ TẢI DỮ LIỆU WIKI MỚI THÀNH CÔNG';
                          btn.classList.add('!bg-emerald-600/30', '!border-emerald-500/50', '!text-emerald-200');
                        } else {
                          btn.innerHTML = '❌ LỖI ĐỒNG BỘ';
                          btn.classList.add('!bg-rose-600/30', '!border-rose-500/50', '!text-rose-200');
                        }
                      } catch (err: any) {
                        btn.innerHTML = '❌ LỖI KẾT NỐI SERVER TRỰC TIẾP';
                      }
                      setTimeout(() => { 
                        btn.innerHTML = '🔄 Cập Nhật Bằng Tay: Quét Lại Nguồn Lịch Ngày Tốt'; 
                        btn.disabled = false;
                        btn.classList.remove('!bg-emerald-600/30', '!border-emerald-500/50', '!text-emerald-200', '!bg-rose-600/30', '!border-rose-500/50', '!text-rose-200');
                      }, 4000);
                    }}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/60 text-amber-200/90 hover:text-amber-200 font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  >
                    🔄 Cập Nhật Bằng Tay: Quét Lại Nguồn Lịch Ngày Tốt
                  </button>
                </div>
              </div>
            </div>

            {/* Cột 2: AI Dashboard */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative group flex flex-col">
              <div className="absolute top-0 right-0 w-1/2 h-1 bg-gradient-to-l from-cyan-500/0 via-cyan-500 to-cyan-500/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-base font-black text-cyan-300 uppercase tracking-widest leading-none">🧠 Bảng Đo Trạng Thái Sever AI (Groq)</h2>
                <div className={`w-3 h-3 rounded-full ${llmStatus.status === 'ready' ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)] animate-pulse' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.9)]'}`}></div>
              </div>

              <div className="bg-black/30 p-2 rounded-2xl border border-white/5 mb-6 shrink-0">
                <button 
                  disabled={isPinging || !socket}
                  onClick={() => { setIsPinging(true); socket?.emit('ping_llm'); }}
                  className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-200 font-bold py-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isPinging ? <span className="animate-pulse">⏳ Đang gửi tín hiệu kiểm tra...</span> : '⚡ Nhấn để Kiểm Tra Tốc Độ Trả Lời Của AI'}
                </button>
              </div>

              {llmPingResult && (
                <div className={`p-5 rounded-2xl border mb-6 text-xs shrink-0 ${
                  llmPingResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' : 'bg-rose-500/10 border-rose-500/20 text-rose-100'
                }`}>
                  {llmPingResult.success ? (
                    <div>
                      <strong className="text-emerald-400 block mb-2 tracking-wider text-[11px] border-b border-emerald-500/20 pb-2 uppercase">Thông điệp phản hồi từ Groq: ✅</strong>
                      <span className="opacity-90 leading-relaxed italic block mt-2 text-sm text-emerald-200/80">"{llmPingResult.preview}"</span>
                    </div>
                  ) : (
                    <div><strong className="text-rose-400 block mb-1 text-sm">❌ Mất Kết Nối API:</strong> <span className="opacity-80">{llmPingResult.error}</span></div>
                  )}
                </div>
              )}

              {llmStats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-5 rounded-3xl border border-white/5 relative overflow-hidden group/card hover:border-white/10 transition-colors flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-2"><span className="text-white text-base">🪙</span> Ký Tự Đã Dùng <span className="lowercase font-normal opacity-50 text-[9px]">(Từ khi mở web)</span></div>
                    <div className="text-2xl font-black text-white tracking-tight">{llmStats.totalTokensUsed.toLocaleString()}</div>
                  </div>
                  
                  <div className="bg-cyan-950/20 p-5 rounded-3xl border border-cyan-500/10 relative overflow-hidden group/card hover:border-cyan-500/30 transition-colors flex flex-col justify-center">
                    <div className="text-[10px] text-cyan-500/70 uppercase font-black tracking-widest mb-2 flex items-center gap-2"><span className="text-cyan-400 text-base">🔑</span> Kênh API Đang Chạy</div>
                    <div className="text-2xl font-black text-cyan-100 flex items-baseline gap-1">
                      Kênh {llmStats.limits?.activeKeyIndex || 1}
                      <span className="text-sm font-medium text-cyan-600/70">/ {llmStats.totalKeys || llmStatus.keyCount || 3}</span>
                    </div>
                  </div>
                  
                  <div className="bg-blue-950/20 p-5 rounded-3xl border border-blue-500/10 relative overflow-hidden group/card hover:border-blue-500/30 transition-colors flex flex-col justify-center">
                    <div className="text-[10px] text-blue-500/70 uppercase font-black tracking-widest mb-2 flex items-center gap-2"><span className="text-blue-400 text-base">⚡</span> Lượt Bình Luận Giới Hạn / Phút</div>
                    <div className="text-2xl font-black text-blue-100 flex items-baseline gap-1">
                      {llmStats.limits?.remainingRequests || '--'} 
                      <span className="text-sm font-medium text-blue-600/70">/ {llmStats.limits?.resetRequests || '--'}</span>
                    </div>
                  </div>

                  <div className="bg-indigo-950/20 p-5 rounded-3xl border border-indigo-500/10 relative overflow-hidden group/card hover:border-indigo-500/30 transition-colors flex flex-col justify-center">
                    <div className="text-[10px] text-indigo-500/70 uppercase font-black tracking-widest mb-2 flex items-center gap-2"><span className="text-indigo-400 text-base">🧠</span> Độ Dài Phản Hồi Tối Đa / Phút</div>
                    <div className="text-2xl font-black text-indigo-100">
                      {llmStats.limits?.remainingTokens ? Number(llmStats.limits.remainingTokens).toLocaleString() : '--'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl bg-black/10 text-slate-500">
                   <div className="w-10 h-10 flex items-center justify-center rounded-full bg-cyan-900/40 animate-pulse mb-4">
                      <span className="text-cyan-400 text-lg">🤖</span>
                   </div>
                   <span className="text-xs uppercase font-bold tracking-widest">Đang kết nối siêu luồng AI...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Global CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.98) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; margin: 4px 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; border: 1px solid rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: #c084fc; cursor: pointer; box-shadow: 0 0 10px rgba(168,85,247,0.5); border: 2px solid #fff; }
      `}}/>
    </div>
  );
}
