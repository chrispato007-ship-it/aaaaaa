export type UserRole = 'ella' | 'el';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  coupleId?: string;
  createdAt: string;
}

export interface Couple {
  id: string;
  code: string;
  ellaId: string;
  elId: string;
  ellaName: string;
  elName: string;
  cycleLength: number; // e.g. 28
  periodLength: number; // e.g. 5
  lastPeriodDate: string; // "YYYY-MM-DD"
  currentMood: string; // emoji
  currentMoodLabel: string; // e.g., "Feliz"
  currentMoodDate: string; // "YYYY-MM-DD"
  sweetMessage: string;
  sweetMessageTime: any; // Timestamp or ISO string
}

export interface MessageHistory {
  id: string;
  coupleId: string;
  text: string;
  senderId: string;
  timestamp: any;
}

export interface Coupon {
  id: string;
  coupleId: string;
  title: string;
  description: string;
  isRedeemed: boolean;
  redeemedAt?: any;
  createdAt: any;
}

export interface SymptomLog {
  id: string;
  coupleId: string;
  date: string; // "YYYY-MM-DD"
  mood: string; // emoji
  moodLabel: string;
  cramps: 'none' | 'mild' | 'moderate' | 'severe';
  flow: 'none' | 'light' | 'medium' | 'heavy';
  energy: 'low' | 'medium' | 'high';
  notes: string;
}

export interface CoupleAlert {
  id: string;
  coupleId: string;
  senderId: string;
  recipientId: string;
  type: 'sos' | 'coupon_redeem' | 'new_message' | 'mood_change' | 'cycle_update';
  title: string;
  message: string;
  isRead: boolean;
  timestamp: any;
}

export type CyclePhase = 'Menstruación' | 'Folicular' | 'Ovulatoria' | 'Lútea';

export interface PhaseInfo {
  phase: CyclePhase;
  color: string;
  bgLight: string;
  borderAccent: string;
  description: string;
  tips: string[];
}

export interface InstantPhoto {
  id: string;
  coupleId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  imageUrl: string; // base64 string
  caption: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
}
