import { NextResponse } from 'next/server';
import { runDailyScraper } from '../../../../../scripts/update_daily_wiki';

export async function POST(req: Request) {
  try {
    // Run the scraper
    await runDailyScraper();
    return NextResponse.json({ success: true, message: 'Đã cập nhật Daily Wiki thành công!' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
