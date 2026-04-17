import { NextResponse } from 'next/server';
import { getAudioBase64 } from 'google-tts-api';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const rawChunks = text.match(/[^.!?]+[.!?]*/g) || [text];
    const optimizedChunks: string[] = [];
    let current = "";
    for (const phrase of rawChunks) {
       if (current.length + phrase.length > 180) {
           if (current) optimizedChunks.push(current.trim());
           current = phrase;
       } else {
           current += " " + phrase;
       }
    }
    if (current) optimizedChunks.push(current.trim());

    // Cực kỳ quan trọng: Phải gọi tải Base64 trên Server (Nodejs) để bypass cơ chế chống Hotlink (Referer) của Google
    const promises = optimizedChunks.filter(c => c.length > 0).map(chunk => 
        getAudioBase64(chunk, {
            lang: 'vi',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        }).catch(err => {
            console.error("Lỗi get audio 1 chunk:", err);
            return null; // Bỏ qua chunk lỗi
        })
    );
    const base64Results = await Promise.all(promises);
    
    const validBase64 = base64Results.filter(b => b !== null);
    
    // Trả về mảng base64 thuần
    return NextResponse.json({ chunks: validBase64.map(b => ({ base64: b })) });
  } catch (error: any) {
    console.error("Google TTS Server error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
