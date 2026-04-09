const fs = require('fs');
const path = require('path');

const STATIC_DIR = path.join(__dirname, '../data/static_wiki');

if (!fs.existsSync(STATIC_DIR)) {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
}

// 1. Sinh Từ điển Cung Hoàng Đạo (Chuẩn Vansu.net)
const zodiacRanges = [
  { name: 'Bạch Dương', emoji: '♈️', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { name: 'Kim Ngưu', emoji: '♉', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { name: 'Song Tử', emoji: '♊', startMonth: 5, startDay: 21, endMonth: 6, endDay: 21 },
  { name: 'Cự Giải', emoji: '♋', startMonth: 6, startDay: 22, endMonth: 7, endDay: 22 },
  { name: 'Sư Tử', emoji: '♌', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { name: 'Xử Nữ', emoji: '♍', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { name: 'Thiên Bình', emoji: '♎', startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { name: 'Bọ Cạp', emoji: '♏', startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { name: 'Nhân Mã', emoji: '♐', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  { name: 'Ma Kết', emoji: '♑', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { name: 'Bảo Bình', emoji: '♒', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { name: 'Song Ngư', emoji: '♓', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 }
];

const zodiacDict: Record<string, {name: string, emoji: string}> = {};

// Điền đủ 365 ngày
for (let month = 1; month <= 12; month++) {
  const daysInMonth = new Date(2024, month, 0).getDate(); // năm nhuận để đủ 29/2
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    let found = false;
    for (const z of zodiacRanges) {
      if ((month === z.startMonth && day >= z.startDay) || (month === z.endMonth && day <= z.endDay)) {
        zodiacDict[key] = { name: z.name, emoji: z.emoji };
        found = true;
        break;
      }
    }
    // Riêng Ma Kết vắt chéo năm nên cần handle đặc biệt
    if (!found) {
       zodiacDict[key] = { name: 'Ma Kết', emoji: '♑' };
    }
  }
}

fs.writeFileSync(path.join(STATIC_DIR, 'zodiac_dict.json'), JSON.stringify(zodiacDict, null, 2), 'utf8');
console.log('✅ Đã tạo bảng tra cứu Cung Hoàng Đạo (zodiac_dict.json)');

// 2. Sinh Lục Thập Hoa Giáp (1930 - 2050)
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

// Quy ước giá trị tính Nạp Âm Lục Thập Hoa Giáp
const qCan: Record<string, number> = { 'Giáp': 1, 'Ất': 1, 'Bính': 2, 'Đinh': 2, 'Mậu': 3, 'Kỷ': 3, 'Canh': 4, 'Tân': 4, 'Nhâm': 5, 'Quý': 5 };
const qChi: Record<string, number> = { 'Tý': 0, 'Sửu': 0, 'Ngọ': 0, 'Mùi': 0, 'Dần': 1, 'Mão': 1, 'Thân': 1, 'Dậu': 1, 'Thìn': 2, 'Tỵ': 2, 'Tuất': 2, 'Hợi': 2 };
const qMenh: Record<number, string> = { 1: 'Kim', 2: 'Thủy', 3: 'Hỏa', 4: 'Thổ', 5: 'Mộc' };

// Bảng nạp âm Mệnh mở rộng chính xác (Map Ngũ Hành to Nạp Âm)
const NAP_AM_MAP: Record<string, string> = {
  "Giáp Tý": "Hải Trung Kim", "Ất Sửu": "Hải Trung Kim",
  "Bính Dần": "Lư Trung Hỏa", "Đinh Mão": "Lư Trung Hỏa",
  "Mậu Thìn": "Đại Lâm Mộc", "Kỷ Tỵ": "Đại Lâm Mộc",
  "Canh Ngọ": "Lộ Bàng Thổ", "Tân Mùi": "Lộ Bàng Thổ",
  "Nhâm Thân": "Kiếm Phong Kim", "Quý Dậu": "Kiếm Phong Kim",
  "Giáp Tuất": "Sơn Đầu Hỏa", "Ất Hợi": "Sơn Đầu Hỏa",
  "Bính Tý": "Giản Hạ Thủy", "Đinh Sửu": "Giản Hạ Thủy",
  "Mậu Dần": "Thành Đầu Thổ", "Kỷ Mão": "Thành Đầu Thổ",
  "Canh Thìn": "Bạch Lạp Kim", "Tân Tỵ": "Bạch Lạp Kim",
  "Nhâm Ngọ": "Dương Liễu Mộc", "Quý Mùi": "Dương Liễu Mộc",
  "Giáp Thân": "Tuyền Trung Thủy", "Ất Dậu": "Tuyền Trung Thủy",
  "Bính Tuất": "Ốc Thượng Thổ", "Đinh Hợi": "Ốc Thượng Thổ",
  "Mậu Tý": "Tích Lịch Hỏa", "Kỷ Sửu": "Tích Lịch Hỏa",
  "Canh Dần": "Tùng Bách Mộc", "Tân Mão": "Tùng Bách Mộc",
  "Nhâm Thìn": "Trường Lưu Thủy", "Quý Tỵ": "Trường Lưu Thủy",
  "Giáp Ngọ": "Sa Trung Kim", "Ất Mùi": "Sa Trung Kim",
  "Bính Thân": "Sơn Hạ Hỏa", "Đinh Dậu": "Sơn Hạ Hỏa",
  "Mậu Tuất": "Bình Địa Mộc", "Kỷ Hợi": "Bình Địa Mộc",
  "Canh Tý": "Bích Thượng Thổ", "Tân Sửu": "Bích Thượng Thổ",
  "Nhâm Dần": "Kim Bạch Kim", "Quý Mão": "Kim Bạch Kim",
  "Giáp Thìn": "Phú Đăng Hỏa", "Ất Tỵ": "Phú Đăng Hỏa",
  "Bính Ngọ": "Thiên Hà Thủy", "Đinh Mùi": "Thiên Hà Thủy",
  "Mậu Thân": "Đại Trạch Thổ", "Kỷ Dậu": "Đại Trạch Thổ",
  "Canh Tuất": "Thoa Xuyến Kim", "Tân Hợi": "Thoa Xuyến Kim",
  "Nhâm Tý": "Tang Đố Mộc", "Quý Sửu": "Tang Đố Mộc",
  "Giáp Dần": "Đại Khê Thủy", "Ất Mão": "Đại Khê Thủy",
  "Bính Thìn": "Sa Trung Thổ", "Đinh Tỵ": "Sa Trung Thổ",
  "Mậu Ngọ": "Thiên Thượng Hỏa", "Kỷ Mùi": "Thiên Thượng Hỏa",
  "Canh Thân": "Thạch Lựu Mộc", "Tân Dậu": "Thạch Lựu Mộc",
  "Nhâm Tuất": "Đại Hải Thủy", "Quý Hợi": "Đại Hải Thủy"
};

const canchiDict: Record<string, { canChi: string, nguHanh: string, napAm: string, conGiap: string }> = {};

for (let y = 1930; y <= 2050; y++) {
  const can = CAN[y % 10];
  const chi = CHI[y % 12];
  const canChiStr = `${can} ${chi}`;
  
  let val = qCan[can] + qChi[chi];
  if (val > 5) val -= 5;
  const nguHanh = qMenh[val];
  
  const napAm = NAP_AM_MAP[canChiStr] || nguHanh;

  canchiDict[y.toString()] = {
    canChi: canChiStr,
    conGiap: chi,
    nguHanh: nguHanh,
    napAm: napAm
  };
}

fs.writeFileSync(path.join(STATIC_DIR, 'canchi_dict.json'), JSON.stringify(canchiDict, null, 2), 'utf8');
console.log('✅ Đã tạo bảng tra cứu Lục Thập Hoa Giáp (canchi_dict.json)');
