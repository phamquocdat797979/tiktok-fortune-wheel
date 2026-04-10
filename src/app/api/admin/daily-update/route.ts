import { NextResponse } from 'next/server';
import { scrapeCung } from '../../../../../scripts/update_cung';
import { scrapeTuoi } from '../../../../../scripts/update_tuoi';

export async function POST(req: Request) {
  try {
    console.log('[ADMIN] Bắt đầu cập nhật Daily Wiki...');
    
    // Chạy tuần tự: cung trước, tuổi sau
    await scrapeCung();
    console.log('[ADMIN] ✅ Hoàn tất 12 Cung Hoàng Đạo.');
    
    await scrapeTuoi();
    console.log('[ADMIN] ✅ Hoàn tất 12 Con Giáp.');

    return NextResponse.json({ 
      success: true, 
      message: 'Đã cập nhật Daily Wiki thành công! (12 Cung + 12 Con Giáp)' 
    });
  } catch (err: any) {
    console.error('[ADMIN] ❌ Lỗi cập nhật wiki:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
