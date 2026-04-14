// ─── Entity Types ───────────────────────────────────────────────

export type SportType = 'padel' | 'tennis' | 'squash' | 'badminton';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type LegalEntityStatus = 'commercial' | 'non_profit';

// ─── Club ───────────────────────────────────────────────────────

export interface Club {
  id: string;
  name: string;
  organizationNumber: string;
  isNonProfit: boolean;
  timezone: string;
  stripeAccountId: string | null;
  createdAt: Date;
}

export interface CreateClubInput {
  name: string;
  organizationNumber: string;
  isNonProfit: boolean;
  timezone?: string;
}

// ─── Court ──────────────────────────────────────────────────────

export interface Court {
  id: string;
  clubId: string;
  name: string;
  sportType: SportType;
  isIndoor: boolean;
  baseHourlyRate: number;
  hardwareRelayId: string | null;
}

export interface CreateCourtInput {
  clubId: string;
  name: string;
  sportType: SportType;
  isIndoor?: boolean;
  baseHourlyRate: number;
  hardwareRelayId?: string;
}

// ─── User ───────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  eloPadel: number;
  eloTennis: number;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber?: string;
}

// ─── Booking ────────────────────────────────────────────────────

export interface Booking {
  id: string;
  courtId: string;
  bookerId: string;
  timeSlot: { start: string; end: string };
  status: BookingStatus;
  totalPrice: number;
  accessPin: string | null;
  createdAt: Date;
}

export interface CreateBookingInput {
  courtId: string;
  userId: string;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
  isSplitPayment: boolean;
  splitParticipants?: string[];
}

// ─── Split Payment ──────────────────────────────────────────────

export interface SplitPayment {
  id: string;
  bookingId: string;
  userId: string;
  amountDue: number;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId: string | null;
}

// ─── Elo ────────────────────────────────────────────────────────

export interface EloTeam {
  p1: number;
  p2: number;
}

export interface EloUpdateResult {
  team1: EloTeam;
  team2: EloTeam;
}

export interface MatchResult {
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Won: boolean;
  sportType: SportType;
  scoreMargin?: number; // e.g. 6-0 = 6, 7-6 = 1
}

// ─── Tournament ─────────────────────────────────────────────────

export interface TournamentMatch {
  team1: string[];
  team2: string[];
}

export interface TournamentRound {
  roundNumber: number;
  matches: TournamentMatch[];
}

export interface Tournament {
  id: string;
  clubId: string;
  name: string;
  sportType: SportType;
  format: 'americano' | 'mexicano';
  players: string[];
  rounds: TournamentRound[];
  pointsPerMatch: number;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}

// ─── IoT ────────────────────────────────────────────────────────

export type IoTAction = 'SET_PIN' | 'RELAY_ON' | 'RELAY_OFF';

export interface IoTPayload {
  action: IoTAction;
  hardwareId: string;
  parameters: Record<string, unknown>;
}

// ─── VAT ────────────────────────────────────────────────────────

export interface VatBreakdown {
  courtRentalAmount: number;
  courtRentalVatRate: number;  // 0.06 for commercial, 0 for non-profit
  courtRentalVat: number;
  platformFeeAmount: number;
  platformFeeVatRate: number;  // 0.25 always
  platformFeeVat: number;
  totalAmount: number;
  totalVat: number;
}

// ─── API Responses ──────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
