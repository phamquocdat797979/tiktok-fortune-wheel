import * as cheerio from 'cheerio';

async function debug() {
    const url = "https://lichngaytot.com/tu-vi/tu-vi-hang-ngay-11-4-2026-cua-12-con-giap-304-233301.html";
    const res = await fetch(url + '?t=' + Date.now().toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const rawHTML = await res.text();
    const html = rawHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h1|h2|h3|h4|li|td|th|ul)>/gi, '\n\n');
    const $ = cheerio.load(html);
    
    $('script, style, noscript, iframe, nav, header, footer, .jeg_share_button, .adsbygoogle').remove();
    let text = $('body').text().replace(/\n{3,}/g, '\n\n').trim();

    console.log("TOTAL TEXT LENGTH:", text.length);
    console.log("FIRST 500 CHARS:", text.substring(0, 500));
    
    const startAnchor = "II. Chi tiết tử vi hàng ngày";
    const endAnchor = "III. Video tử vi";
    
    const sIdx = text.indexOf(startAnchor);
    const eIdx = text.indexOf(endAnchor, sIdx);
    
    console.log(`sIdx: ${sIdx}, eIdx: ${eIdx}`);
    if (sIdx !== -1) {
        console.log("SLICE START (50 chars):", text.substring(sIdx, sIdx + 50));
    }
}

debug();
