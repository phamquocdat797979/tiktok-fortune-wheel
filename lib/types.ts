export type NguHanh = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

export interface WheelSegment {
  id: number;
  conGiap: string;
  cungHoangDao: string;
  nguHanh: NguHanh;
  emojiConGiap?: string;
  emojiCung?: string;
}

export interface AstrologyData {
  conGiap?: string;
  canChi?: string;
  nguHanh?: NguHanh;
  cungHoangDao?: string;
  soChuDao?: number;
}

export interface FortuneResult {
  segment: WheelSegment;
  astrologyData: AstrologyData;
  fortuneText: string;
  timestamp: Date;
}

export interface DonorData {
  userId: string;
  uniqueId: string;
  nickname: string;
  giftName?: string;
  diamondCount?: number;
  dobString?: string;
  priority: number;
}
