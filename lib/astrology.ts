import { NguHanh, AstrologyData } from './types';

const CAN_ARR = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI_ARR = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
const CON_GIAP_ARR = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

// Giá trị ngũ hành của Can
const CAN_VALUE: Record<string, number> = {
  'Giáp': 1, 'Ất': 1,
  'Bính': 2, 'Đinh': 2,
  'Mậu': 3, 'Kỷ': 3,
  'Canh': 4, 'Tân': 4,
  'Nhâm': 5, 'Quý': 5
};

// Giá trị ngũ hành của Chi
const CHI_VALUE: Record<string, number> = {
  'Tý': 0, 'Sửu': 0, 'Ngọ': 0, 'Mùi': 0,
  'Dần': 1, 'Mão': 1, 'Thân': 1, 'Dậu': 1,
  'Thìn': 2, 'Tỵ': 2, 'Tuất': 2, 'Hợi': 2
};

const NGU_HANH_VALUE: Record<number, NguHanh> = {
  1: 'Kim',
  2: 'Thủy',
  3: 'Hỏa',
  4: 'Thổ',
  5: 'Mộc'
};

export function tinhCanChi(year: number) {
  const can = CAN_ARR[year % 10];
  const chi = CHI_ARR[year % 12];
  const conGiap = CON_GIAP_ARR[year % 12];
  return { can, chi, conGiap };
}

export function tinhNguHanh(can: string, chi: string): NguHanh {
  let val = CAN_VALUE[can] + CHI_VALUE[chi];
  if (val > 5) val -= 5;
  return NGU_HANH_VALUE[val];
}

export function tinhCungHoangDao(day: number, month: number): string | null {
  if (month === 3 && day >= 21 || month === 4 && day <= 19) return 'Bạch Dương';
  if (month === 4 && day >= 20 || month === 5 && day <= 20) return 'Kim Ngưu';
  if (month === 5 && day >= 21 || month === 6 && day <= 21) return 'Song Tử';
  if (month === 6 && day >= 22 || month === 7 && day <= 22) return 'Cự Giải';
  if (month === 7 && day >= 23 || month === 8 && day <= 22) return 'Sư Tử';
  if (month === 8 && day >= 23 || month === 9 && day <= 22) return 'Xử Nữ';
  if (month === 9 && day >= 23 || month === 10 && day <= 23) return 'Thiên Bình';
  if (month === 10 && day >= 24 || month === 11 && day <= 22) return 'Bọ Cạp';
  if (month === 11 && day >= 23 || month === 12 && day <= 21) return 'Nhân Mã';
  if (month === 12 && day >= 22 || month === 1 && day <= 19) return 'Ma Kết';
  if (month === 1 && day >= 20 || month === 2 && day <= 18) return 'Bảo Bình';
  if (month === 2 && day >= 19 || month === 3 && day <= 20) return 'Song Ngư';
  return null;
}

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
    // Chỉ có năm
    year = parseInt(parts[0], 10);
    if (year < 100) year += (year < 30 ? 2000 : 1900);
  } else if (parts.length === 2) {
    // DD/MM hoặc MM/YYYY
    const p2 = parseInt(parts[1], 10);
    if (p2 > 31) {
      // Dạng MM/YYYY
      month = parseInt(parts[0], 10);
      year = p2;
    } else {
      // Dạng DD/MM
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
  } else if (parts.length >= 3) {
    // DD/MM/YYYY
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  // Đảm bảo logic tính toán nếu số quá vô lý
  if (year && year < 100) year += (year < 30 ? 2000 : 1900);
  
  if (year && !isNaN(year)) {
     // NOTE: Chúng ta đang dùng Dương Lịch tương đương năm để tính nhanh vì user nhập trên Tiktok
     // thường không tra trước ngày âm lịch. Độ chính xác ~90% trừ những ngày đệm đầu năm.
     const { can, chi, conGiap } = tinhCanChi(year);
     result.canChi = `${can} ${chi}`;
     result.conGiap = conGiap;
     result.nguHanh = tinhNguHanh(can, chi);
  }

  if (day && month && !isNaN(day) && !isNaN(month)) {
     const cung = tinhCungHoangDao(day, month);
     if (cung) result.cungHoangDao = cung;
  }

  if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
     result.soChuDao = tinhSoChuDao(day, month, year);
  }

  return result;
}
