import * as fs from 'fs';
import * as path from 'path';
import { AstrologyData } from './types';

// Hàm helper đọc JSON an toàn (đồng bộ)
function loadJsonDict(filename: string) {
  try {
    const fullPath = path.join(__dirname, '../data/static_wiki', filename);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Không thể đọc từ điển ${filename}:`, err);
    return {};
  }
}

const zodiacDict = loadJsonDict('zodiac_dict.json');
const canchiDict = loadJsonDict('canchi_dict.json');

export function tinhSoChuDao(day: number, month: number, year: number): number {
  let sum = 0;
  const str = `${day}${month}${year}`;
  for (let char of str) {
    sum += parseInt(char, 10);
  }

  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    let tempSum = 0;
    const sumStr = sum.toString();
    for (let char of sumStr) {
      tempSum += parseInt(char, 10);
    }
    sum = tempSum;
  }
  return sum;
}

// Hàm chính xử lý parsing từ các định dạng linh hoạt: YYYY, MM/YYYY, DD/MM, DD/MM/YYYY
export function calculateAstrology(dobString: string): AstrologyData {
  const result: AstrologyData = {};
  
  // Xóa các ký tự không phải số hoặc [/-]
  const cleanStr = dobString.toLowerCase().replace(/[^0-9/-]/g, '/').replace(/\/+/g, '/').trim();
  const parts = cleanStr.split('/').filter(p => p !== '');
  
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  if (parts.length === 1) {
    year = parseInt(parts[0], 10);
    if (year < 100) year += (year < 30 ? 2000 : 1900);
  } else if (parts.length === 2) {
    const p2 = parseInt(parts[1], 10);
    if (p2 > 31) {
      month = parseInt(parts[0], 10);
      year = p2;
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
  } else if (parts.length >= 3) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (year && year < 100) year += (year < 30 ? 2000 : 1900);
  
  // 1. Dò Dữ Liệu Theo Năm (Lục Thập Hoa Giáp)
  if (year && !isNaN(year)) {
     const yearStr = year.toString();
     const canchiInfo = canchiDict[yearStr];
     if (canchiInfo) {
       result.canChi = canchiInfo.canChi;
       result.conGiap = canchiInfo.conGiap;
       // Trả về Nạp Âm chi tiết (Ví dụ: Tuyền Trung Thủy)
       result.nguHanh = canchiInfo.napAm as any; 
     }
  }

  // 2. Dò Dữ Liệu Theo Ngày Tháng (Cung Hoàng Đạo)
  if (day && month && !isNaN(day) && !isNaN(month)) {
     const key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
     const zodiacInfo = zodiacDict[key];
     if (zodiacInfo) {
       result.cungHoangDao = zodiacInfo.name;
     }
  }

  // 3. Tính Số Chủ Đạo (Vẫn giữ vì đây là tính toán số học chuẩn)
  if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
     result.soChuDao = tinhSoChuDao(day, month, year);
  }

  return result;
}
