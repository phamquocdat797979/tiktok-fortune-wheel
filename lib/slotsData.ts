import { WheelSegment } from './types';

// Danh sách ghép cặp cứng Con Giáp và Cung Hoàng Đạo
// Lưu ý: Sự ghép cặp này là ngẫu nhiên cho đủ mặt 12 ô,
// bánh xe sẽ quay trực tiếp tới ô có text tương ứng nếu input parse ra khớp.
export const SLOTS: WheelSegment[] = [
  { id: 1, conGiap: 'Tý',    cungHoangDao: 'Bạch Dương', nguHanh: 'Thủy', emojiConGiap: '🐀', emojiCung: '♈' },
  { id: 2, conGiap: 'Sửu',   cungHoangDao: 'Kim Ngưu',   nguHanh: 'Thổ',  emojiConGiap: '🐃', emojiCung: '♉' },
  { id: 3, conGiap: 'Dần',   cungHoangDao: 'Song Tử',    nguHanh: 'Mộc',  emojiConGiap: '🐅', emojiCung: '♊' },
  { id: 4, conGiap: 'Mão',   cungHoangDao: 'Cự Giải',    nguHanh: 'Mộc',  emojiConGiap: '🐈', emojiCung: '♋' },
  { id: 5, conGiap: 'Thìn',  cungHoangDao: 'Sư Tử',      nguHanh: 'Thổ',  emojiConGiap: '🐉', emojiCung: '♌' },
  { id: 6, conGiap: 'Tỵ',    cungHoangDao: 'Xử Nữ',      nguHanh: 'Hỏa',  emojiConGiap: '🐍', emojiCung: '♍' },
  { id: 7, conGiap: 'Ngọ',   cungHoangDao: 'Thiên Bình', nguHanh: 'Hỏa',  emojiConGiap: '🐎', emojiCung: '♎' },
  { id: 8, conGiap: 'Mùi',   cungHoangDao: 'Bọ Cạp',     nguHanh: 'Thổ',  emojiConGiap: '🐐', emojiCung: '♏' },
  { id: 9, conGiap: 'Thân',  cungHoangDao: 'Nhân Mã',    nguHanh: 'Kim',  emojiConGiap: '🐒', emojiCung: '♐' },
  { id: 10, conGiap: 'Dậu',  cungHoangDao: 'Ma Kết',     nguHanh: 'Kim',  emojiConGiap: '🐓', emojiCung: '♑' },
  { id: 11, conGiap: 'Tuất', cungHoangDao: 'Bảo Bình',   nguHanh: 'Thổ',  emojiConGiap: '🐕', emojiCung: '♒' },
  { id: 12, conGiap: 'Hợi',  cungHoangDao: 'Song Ngư',   nguHanh: 'Thủy', emojiConGiap: '🐖', emojiCung: '♓' },
];
