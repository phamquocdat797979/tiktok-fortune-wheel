'use client';

import { useEffect, useRef } from 'react';
import { WheelSegment } from '../lib/types';
import { SLOTS } from '../lib/slotsData';

interface WheelCanvasProps {
  segments?: WheelSegment[];
  currentRotation?: number;
  isSpinning?: boolean;
}

const SIZE = 1000;
const CX = SIZE / 2;
const CY = SIZE / 2;
// Đo từ file la-ban-overlay.png (1024x1024) tren truc doc:
// Hub (opaque):       0 -> 165px (canvas 1000)
// Lỗ rỗng donut:      165px -> 358px  (canvas 1000)
// Vành đồng (opaque): 358px -> 450px  (canvas 1000)
const WHEEL_R = 445;        // Outer radius mâm màu - sát mép trong viền đồng, lấp vùng tối
const TEXT_START_R = 165;   // Inner radius dải màu = tâm hub
const TEXT_END_R = 355;     // Giới hạn ngoài để canh giữa text (không tràn ra sau viền đồng)

// --- TRẠM ĐIỀU KHIỂN CÂN CHỈNH LẮP RÁP ---
const CANVAS_SCALE = 1.0;
const CANVAS_OFFSET_X = 0;
const CANVAS_OFFSET_Y = 0;
// PNG overlay lệch tâm: dx=-27px, dy=+6px (đo từ file ảnh)
// => Bù trừ bằng cách dịch ngược ảnh PNG: translate(+27px, -6px)
const PNG_OFFSET_X = 27;  // Dịch phải +27px để tâm la bàn vào giữa
const PNG_OFFSET_Y = -6;  // Dịch lên -6px
// -----------------------------------------------------------------

// Bảng 5 màu Ngũ Hành (Tone Muted/Vintage) phù hợp với La Bàn cổ
const NGU_HANH_COLORS: Record<string, [string, string]> = {
  'Kim': ['#4a4e59', '#8a8d91'], // Kim loại cũ rỉ mờ (Vintage Steel)
  'Mộc': ['#223a28', '#405c46'], // Gỗ chìm/ Rêu phong (Aged Olive)
  'Thủy': ['#18273b', '#38506e'], // Xanh biển sâu phai màu (Navy Slate)
  'Hỏa': ['#5a1818', '#8a3131'], // Đỏ gạch nung/ Huyết dụ (Burnt Crimson)
  'Thổ': ['#603e19', '#96703b'], // Đồng cổ/ Đất nung (Antique Bronze/Ochre)
};

function buildOffscreenWheel(segments: WheelSegment[]): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = SIZE; oc.height = SIZE;
  const ctx = oc.getContext('2d')!;
  const sliceAngle = (2 * Math.PI) / segments.length;

  segments.forEach((seg, i) => {
    const start = i * sliceAngle;
    const end = start + sliceAngle;

    const [darkCol, brightCol] = NGU_HANH_COLORS[seg.nguHanh || 'Thổ'] || ['#854D0E', '#FBBF24'];

    // Vẽ VÀNH KHUYÊN (annular sector) - không tạo tam giác nhọn vào tâm
    ctx.beginPath();
    ctx.arc(CX, CY, WHEEL_R, start, end);         // Cung ngoài
    ctx.arc(CX, CY, TEXT_START_R, end, start, true); // Cung trong (ngược chiều)
    ctx.closePath();

    // Gradient từ trong ra ngoài
    const segGrad = ctx.createRadialGradient(CX, CY, TEXT_START_R, CX, CY, WHEEL_R);
    segGrad.addColorStop(0, darkCol);
    segGrad.addColorStop(0.5, brightCol);
    segGrad.addColorStop(1, darkCol);
    ctx.fillStyle = segGrad;
    ctx.fill();

    // Đường kẻ phân cách nhẹ giữa các ô
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bỏ qua hiệu ứng dac_biet vì không còn sử dụng
  });

  // Ghi Text - clip theo đúng vành khuyên của mỗi ô
  segments.forEach((seg, i) => {
    const start = i * sliceAngle;
    const end = start + sliceAngle;
    const mid = start + sliceAngle / 2;

    ctx.save();

    // Clip theo hình vành khuyên của ô này (thu nhỏ 4px để không đụng viền)
    ctx.beginPath();
    ctx.arc(CX, CY, WHEEL_R - 4, start + 0.02, end - 0.02);
    ctx.arc(CX, CY, TEXT_START_R + 4, end - 0.02, start + 0.02, true);
    ctx.closePath();
    ctx.clip();

    ctx.translate(CX, CY);
    ctx.rotate(mid);

    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const midRadius = (TEXT_START_R + TEXT_END_R) / 2;  // Căn giữa vùng lỗ hở thực sự (165-355px)
    const maxLen = 30;
    const rawLabel = `${seg.emojiConGiap || ''} ${seg.conGiap || ''} - ${seg.emojiCung || ''} ${seg.cungHoangDao || ''}`.trim();
    const label = rawLabel.length > maxLen ? rawLabel.slice(0, maxLen - 1) + '…' : rawLabel;

    ctx.fillText(label, midRadius, 0);

    ctx.restore();
  });

  return oc;
}

export function WheelCanvas({ segments = SLOTS, currentRotation = 0, isSpinning = false }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const rotRef = useRef(0);
  const isSpinRef = useRef(false);
  const segsRef = useRef(segments);
  const activeSegRef = useRef(0);
  const segTimerRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => { rotRef.current = currentRotation; }, [currentRotation]);
  useEffect(() => { isSpinRef.current = isSpinning; }, [isSpinning]);

  useEffect(() => {
    offscreenRef.current = buildOffscreenWheel(segments);
    segsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const loop = (time: number) => {
      const dt = Math.min(time - (lastTimeRef.current || time), 50);
      lastTimeRef.current = time;

      const spinning = isSpinRef.current;
      const segs = segsRef.current;
      const canvas = canvasRef.current;
      const offscreen = offscreenRef.current;
      if (!canvas || !offscreen) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      segTimerRef.current += dt;
      const segInterval = spinning ? 30 : 1000;
      if (segTimerRef.current >= segInterval) {
        activeSegRef.current = (activeSegRef.current + 1) % segs.length;
        segTimerRef.current = 0;
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      // QUAY MÂM ĐÁY CHỨA MÀU VÀ CHỮ
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate((rotRef.current * Math.PI) / 180);
      ctx.drawImage(offscreen, -CX, -CY);

      // KHÓI HIGHLIGHT KIỂU BỤI PHÉP THUẬT (Mờ Ảo Tôn Ô Màu)
      const sliceAngle = (Math.PI * 2) / segs.length;
      const glowStart = activeSegRef.current * sliceAngle;
      const glowEnd = glowStart + sliceAngle;
      const glowMid = glowStart + sliceAngle / 2;

      // GLOW nhẹ trên ô đang active - Vẽ DÀNH KHUYÊN (không nhọn vào tâm)
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL_R - 5, glowStart, glowEnd);
      ctx.arc(0, 0, TEXT_START_R + 5, glowEnd, glowStart, true);
      ctx.closePath();

      const glowGrad = ctx.createRadialGradient(
        Math.cos(glowMid) * (TEXT_START_R + WHEEL_R) / 2, Math.sin(glowMid) * (TEXT_START_R + WHEEL_R) / 2, 0,
        Math.cos(glowMid) * (TEXT_START_R + WHEEL_R) / 2, Math.sin(glowMid) * (TEXT_START_R + WHEEL_R) / 2, (WHEEL_R - TEXT_START_R) / 2
      );
      glowGrad.addColorStop(0, 'rgba(255,255,200,0.55)');
      glowGrad.addColorStop(1, 'rgba(255,180,0,0.0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center transition-all duration-300">



      {/* KHỐI SANDWICH RÁP KHUNG ẢNH PNG THỰC TẾ */}
      {/* 1. Mâm Màu Tròn Xoay Liên Tục Nằm Dưới */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="absolute inset-0 w-full h-full z-0 object-contain"
        style={{ transform: `translate(${CANVAS_OFFSET_X}px, ${CANVAS_OFFSET_Y}px) scale(${CANVAS_SCALE})` }}
      />

      {/* 2. KHUNG NẮP CHỤP BẰNG HÌNH THẬT (TĨNH) KẸP LÊN TRÊN */}
<<<<<<< Updated upstream
      <img 
        src="/la-ban-overlay.png" 
        className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none drop-shadow-2xl" 
=======
      <img
        src="/la-ban-overlay.png"
        className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none drop-shadow-2xl"
>>>>>>> Stashed changes
        style={{ transform: `translate(${PNG_OFFSET_X}px, ${PNG_OFFSET_Y}px)` }}
        alt="Mặt Đồng Hồ La Bàn"
      />
    </div>
  );
}
