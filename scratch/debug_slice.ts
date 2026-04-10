import * as cheerio from 'cheerio';

async function debug() {
    const url = "https://lichngaytot.com/tu-vi/tu-vi-hang-ngay-11-4-2026-cua-12-con-giap-304-233301.html";
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    const htmlRaw = await res.text();
    
    const html = htmlRaw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h1|h2|h3|h4|li|td|th|ul)>/gi, '\n\n');
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, nav, header, footer, .jeg_share_button, .adsbygoogle').remove();
    let text = $('body').text().replace(/\n{3,}/g, '\n\n').trim();

    const startAnchor = "1. Tử vi ngày";
    const endAnchor = "III. Video";

    const s1 = text.indexOf(startAnchor);
    const s2 = text.indexOf(startAnchor, s1 + startAnchor.length);
    const e = text.indexOf(endAnchor, s2 !== -1 ? s2 : s1);

    console.log("Start anchor 1 found at:", s1);
    console.log("Start anchor 2 found at:", s2);
    console.log("End anchor found at:", e);
    
    if (s1 !== -1) console.log("Text at s1:", text.substring(s1, s1 + 100));
    if (s2 !== -1) console.log("Text at s2:", text.substring(s2, s2 + 100));
}

debug();
