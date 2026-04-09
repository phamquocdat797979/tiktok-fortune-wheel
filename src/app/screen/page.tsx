'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { WheelCanvas } from '../../../components/WheelCanvas';

export default function GameScreen() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wheelStatus, setWheelStatus] = useState<'idle' | 'spinning' | 'boss_event'>('idle');
  const [currentRotation, setCurrentRotation] = useState(0);
  
  const [lastResult, setLastResult] = useState<{ donor: any, astrologyData: any, fortuneText: string | null } | null>(null);
  const [queuePreview, setQueuePreview] = useState<{ position: number; nickname: string; priority: number }[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [scale, setScale] = useState(1);
  
  const currentRotationRef = useRef(0);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const wheelVideoRef = useRef<HTMLVideoElement>(null);
  const titleVideoRef = useRef<HTMLVideoElement>(null);
  const wheelStatusRef = useRef(wheelStatus);

  useEffect(() => { wheelStatusRef.current = wheelStatus; }, [wheelStatus]);

  // Vòng lặp quay chậm mâm màu khi nhàn rỗi (Trạng thái tĩnh)
  useEffect(() => {
     let handle: number;
     let lastTime = performance.now();
     const loop = (time: number) => {
       const dt = time - lastTime;
       lastTime = time;
       // Chỉ quay mâm màu siêu chậm khi rảnh rỗi (~5 độ/giây, tức ~72s 1 vòng)
       if (wheelStatusRef.current === 'idle') {
          setCurrentRotation(prev => (prev + dt * 0.005) % 360);
       }
       handle = requestAnimationFrame(loop);
     };
     handle = requestAnimationFrame(loop);
     return () => cancelAnimationFrame(handle);
  }, []);

  const dismissPopup = () => {
    setLastResult(null);
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  };

  useEffect(() => { currentRotationRef.current = currentRotation; }, [currentRotation]);

  useEffect(() => {
    const bgVid = bgVideoRef.current;
    if (!bgVid) return;

    const syncTime = () => {
       const wheelVid = wheelVideoRef.current;
       // Nới lỏng dung sai đồng bộ lên 0.2s để tránh việc browser khựng giật (stuttering) vì bị ép currentTime liên tục
       if (wheelVid && Math.abs(bgVid.currentTime - wheelVid.currentTime) > 0.2) {
          wheelVid.currentTime = bgVid.currentTime;
       }
    };
    
    const forceSync = () => {
       const wheelVid = wheelVideoRef.current;
       if (wheelVid) wheelVid.currentTime = bgVid.currentTime;
    };

    bgVid.addEventListener('timeupdate', syncTime);
    bgVid.addEventListener('play', forceSync);
    bgVid.addEventListener('seeked', forceSync);

    return () => {
        bgVid.removeEventListener('timeupdate', syncTime);
        bgVid.removeEventListener('play', forceSync);
        bgVid.removeEventListener('seeked', forceSync);
    };
  }, []);

  useEffect(() => {
     const handleResize = () => {
        const newScale = Math.min(window.innerHeight / 1920, window.innerWidth / 1080);
        setScale(newScale);
     };
     handleResize();
     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
    
    socketInstance.on('connect', () => {
      console.log('🔗 Connected to OBS Screen Socket:', socketInstance.id);
    });

    socketInstance.on('start_spin', (data: any) => {
      console.log('🎡 Bắt đầu quay cho:', data.nickname, 'với Target:', data.targetIndex);
      setWheelStatus('spinning');
      
      const exactStopAngle = 360 - (data.targetIndex * (360/12) + (360/24));
      const startingRotation = currentRotationRef.current;
      const currentMod = startingRotation % 360;
      const targetRotation = startingRotation - currentMod + (360 * 12) + exactStopAngle;
      
      let start: number;
      const duration = 7000; 
      
      const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

      const animate = (time: number) => {
        if (!start) start = time;
        const progress = Math.min((time - start) / duration, 1);
        
        setCurrentRotation(startingRotation + (targetRotation - startingRotation) * easeOutExpo(progress));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setWheelStatus('idle');
          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          
          setLastResult(prev => {
             const updated = { 
                donor: data, 
                astrologyData: data.astrologyData, 
                fortuneText: (prev as any)?.lastResultJobId === data.jobId ? prev?.fortuneText : null,
                lastResultJobId: data.jobId
             };
             
             // Nếu kết quả đã về khi đang quay -> Quay xong phát lệnh đọc ngay
             if (updated.fortuneText) {
                console.log('[Screen] Cử quẻ sẵn có, phát lệnh đọc TTS.');
                socketInstance.emit('request_tts_play', { 
                   jobId: data.jobId, 
                   donor: data, 
                   fortuneText: updated.fortuneText 
                });
             }
             return updated as any;
          });

          popupTimerRef.current = setTimeout(() => {
             socketInstance.emit('spin_completed', { donor: data, jobId: data.jobId });
             dismissPopup();
          }, 90000);
        }
      };
      
      requestAnimationFrame(animate);
    });

    socketInstance.on('deliver_fortune_text', (data: any) => {
       console.log('[Screen] Nhận nội dung quẻ:', data.jobId);
       setLastResult(prev => {
           // Trường hợp 1: Spin đã dừng rồi mới có text (Gemini chậm hơn 7s xoay)
           if (prev && (prev as any).lastResultJobId === data.jobId && (prev as any).donor) {
               console.log('[Screen] Spin đã dừng, phát lệnh đọc TTS ngay.');
               socketInstance.emit('request_tts_play', { 
                  jobId: data.jobId, 
                  donor: (prev as any).donor, 
                  fortuneText: data.fortuneText 
               });
               return { ...prev, fortuneText: data.fortuneText };
           }
           // Trường hợp 2: Text về khi wheel đang vẫn đang quay
           return { lastResultJobId: data.jobId, fortuneText: data.fortuneText } as any;
       });
    });

    socketInstance.on('queue_update', (data: any) => {
      setQueueCount(data.count || 0);
      setQueuePreview(data.preview || []);
    });

    socketInstance.on('hide_popup', () => { dismissPopup(); });
    setSocket(socketInstance);

    return () => { socketInstance.disconnect(); };
  }, []);

  return (
    <div className="w-full h-screen flex items-center justify-center overflow-hidden cursor-default" style={{ backgroundColor: '#050510' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }} className="relative w-[1080px] h-[1920px] text-white font-sans flex flex-col items-center overflow-hidden shadow-2xl">
        
        <div className="absolute inset-0 bg-cover bg-center scale-[1.05]" style={{ backgroundImage: 'url(/destiny_bg.png)' }} />
        
        <div className="absolute -top-[50px] -bottom-[50px] -left-[50px] -right-[50px] pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.5 }}>
            <video ref={bgVideoRef} src="/thunder.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover" />
        </div>

        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.65 }}>
            <video src="/medium.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover" />
        </div>

        <div className="absolute inset-0 bg-black/40" />

        {wheelStatus === 'spinning' && (
          <div className="absolute inset-0 bg-black/40 pointer-events-none z-10 transition-colors duration-1000"></div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeScaleIn {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}} />
        <div className="flex flex-col w-[1000px] mt-[60px] mb-[30px] gap-[20px] z-20 flex-shrink-0">
            {/* 2 bảng hướng dẫn nằm cùng 1 hàng */}
            <div className="grid grid-cols-2 gap-[20px]">

               {/* Bảng cú pháp */}
               <div className="bg-slate-900/60 backdrop-blur-xl rounded-[30px] border-[2px] border-white/10 pt-5 pb-5 pl-7 pr-7 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden relative">
                  <div className="absolute top-0 right-0 left-0 h-[5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 shadow-[0_0_20px_rgba(236,72,153,0.8)]"></div>
                  <h3 className="text-[26px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-fuchsia-400 mb-3 flex items-center gap-2">
                     <span className="text-white">📜</span> HƯỚNG DẪN BÌNH LUẬN
                  </h3>
                  <div className="flex flex-col gap-2 text-[20px]">
                     <div className="flex items-start gap-2 bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                        <span className="text-xl mt-0.5">💬</span>
                        <div>
                           <span className="font-bold text-white">Cú pháp:</span>
                           <span className="text-indigo-200"> Bình luận ngày/tháng/năm sinh</span>
                           <div className="text-slate-400 text-[17px] mt-1">
                              Mẫu: <span className="text-amber-300">15/08/1998</span> &nbsp;|&nbsp; <span className="text-amber-300">15/08</span> &nbsp;|&nbsp; <span className="text-amber-300">08/1998</span> &nbsp;|&nbsp; <span className="text-amber-300">1998</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Bảng thứ tự ưu tiên */}
               <div className="bg-slate-900/60 backdrop-blur-xl rounded-[30px] border-[2px] border-white/10 pt-5 pb-5 pl-7 pr-7 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden relative">
                  <div className="absolute top-0 right-0 left-0 h-[5px] bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400 shadow-[0_0_20px_rgba(251,191,36,0.8)]"></div>
                  <h3 className="text-[26px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400 mb-3 flex items-center gap-2">
                     <span className="text-white">⚡</span> Thứ tự ưu tiên hàng đợi
                  </h3>
                  <div className="flex flex-col gap-[6px] text-[20px]">
                     <span className="text-yellow-300 font-semibold">🎁 Tặng quà</span>
                     <span className="text-cyan-300 font-semibold">🔁 Share livestream</span>
                     <span className="text-pink-300 font-semibold">❤️ Thả tim {'>'} 20</span>
                     <span className="text-slate-300">💬 Bình luận thường</span>
                  </div>
               </div>

            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-[30px] border-[2px] border-white/10 pt-5 pb-5 pl-8 pr-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden relative">
               <div className="absolute top-0 right-0 left-0 h-[5px] bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"></div>
               <h3 className="text-[28px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-400 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span>⏳</span> HÀNG ĐỢI</span>
                  <span className="text-[22px] text-white/60 font-normal">{queueCount} người đang chờ</span>
               </h3>
               <div className="grid grid-cols-1 gap-2">
                 {queueCount === 0 ? (
                   <div className="text-slate-600 italic text-[22px] text-center py-3">Hàng đợi trống</div>
                 ) : (
                   Array.from({ length: 3 }).map((_, idx) => {
                     const person = queuePreview[idx];
                     return (
                       <div key={idx} className={`flex items-center gap-4 px-5 py-3 rounded-2xl border ${ person ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5' }`}>
                         <span className={`text-[26px] font-black w-10 text-center ${ idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : 'text-amber-600' }`}>#{idx + 1}</span>
                         <span className={`text-[22px] font-bold ${ person ? 'text-emerald-300' : 'text-slate-700 italic' }`}>
                           {person ? person.nickname : '— chờ thêm người —'}
                         </span>
                         {person && person.priority > 0 && (
                           <span className="ml-auto text-[18px] text-yellow-400">
                             {person.priority >= 1000000 ? '🎁 VIP' : person.priority >= 100000 ? '🔁 Share' : '❤️ Tim'}
                           </span>
                         )}
                       </div>
                     );
                   })
                 )}
               </div>
            </div>
        </div>

        <div className="z-20 w-[850px] h-[850px] mt-[40px] flex justify-center items-center flex-shrink-0 relative">
          {/* Vòng hào quang chạy ngược chiều với cùng tốc độ */}
          <div className="absolute inset-[-60px] rounded-full z-[-1] pointer-events-none border-[2px] border-dashed border-indigo-400/30"
               style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.35) 0%, rgba(79,70,229,0.15) 50%, transparent 70%)', boxShadow: '0 0 150px 30px rgba(99,102,241,0.2), inset 0 0 50px rgba(56,189,248,0.2)', transform: `rotate(${-currentRotation}deg)` }}>
          </div>
          {/* Vòng răng cưa vàng quay cùng chiều với mâm màu */}
          <div className="absolute inset-[-20px] rounded-full z-[-1] pointer-events-none border-[8px] border-dotted border-amber-500/40 mix-blend-screen shadow-[0_0_80px_rgba(180,120,20,0.5)]"
               style={{ transform: `rotate(${currentRotation}deg)` }}>
          </div>
          <div className="absolute inset-0 pointer-events-none z-[50] flex justify-center items-center mix-blend-screen">
             <div className="relative w-[800px] h-[800px]" style={{ clipPath: 'circle(50%)' }}>
                 <video ref={wheelVideoRef} src="/thunder.mp4" autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-110 opacity-70" />
                 <video src="/medium.mp4" autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-110 opacity-65 mix-blend-screen" />
             </div>
          </div>
          <WheelCanvas currentRotation={currentRotation} isSpinning={wheelStatus === 'spinning'} />
        </div>

        {/* HỦY BỎ HIỆU ỨNG TIER RƯỜM RÀ, HIỂN THỊ POPUP HUYỀN BÍ DUY NHẤT */}
        {lastResult && lastResult.donor && (() => {
          const astro = lastResult.astrologyData || {};
          const isTextReady = lastResult.fortuneText !== null;
          
          return (
            <div className="absolute inset-0 flex items-center justify-center z-[200] pointer-events-none">
              <div className={`w-[950px] bg-slate-950/85 backdrop-blur-3xl p-[60px] rounded-[60px] border-[4px] border-yellow-500/80 flex flex-col items-center shadow-[0_0_150px_rgba(251,191,36,0.5)] text-center relative pointer-events-auto animate-[fadeScaleIn_0.4s_ease-out_forwards]`}>
                
                <div className={`absolute -top-[55px] bg-gradient-to-b from-yellow-300 to-amber-600 text-slate-900 font-black text-[36px] px-12 py-3 rounded-full shadow-[0_0_50px_rgba(251,191,36,0.7)] border-4 border-slate-900 tracking-wider uppercase whitespace-nowrap`}>
                  VẬN MỆNH THIÊN THƯ 🌟
                </div>

                <h2 className="text-[72px] font-black mt-10 mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300 drop-shadow-xl leading-tight">
                  {lastResult.donor.nickname}
                </h2>
                
                <div className="flex gap-4 mb-6 uppercase tracking-widest text-[28px] font-medium text-amber-200">
                   {astro.canChi ? <span className="bg-white/10 px-4 py-2 rounded-xl">Tuổi {astro.canChi}</span> : astro.conGiap && <span className="bg-white/10 px-4 py-2 rounded-xl">Tuổi {astro.conGiap}</span>}
                   {astro.cungHoangDao && <span className="bg-white/10 px-4 py-2 rounded-xl">Cung {astro.cungHoangDao}</span>}
                   {astro.nguHanh && <span className="bg-white/10 px-4 py-2 rounded-xl">Mệnh {astro.nguHanh}</span>}
                </div>

                {/* Phần nội dung với hiệu ứng loading nếu chưa fetched */}
                <div className="min-h-[250px] flex items-center justify-center">
                  {!isTextReady ? (
                     <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-amber-500/80 text-[32px] italic mt-4">Vũ trụ đang truyền thông điệp...</p>
                     </div>
                  ) : (
                     <p className="text-[40px] text-white font-medium italic leading-relaxed max-w-[850px] relative text-justify">
                        <span className="absolute -left-12 -top-6 text-[80px] text-amber-500/30">"</span>
                        {lastResult.fortuneText}
                        <span className="absolute -right-12 -bottom-16 text-[80px] text-amber-500/30">"</span>
                     </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
