import { api } from './client';
import type { ApiResponse } from '@racket-booking/shared';

export interface Club {
  id: string;
  name: string;
  city?: string | null;
}

export interface Court {
  id: string;
  club_id: string;
  name: string;
  sport_type: string;
  base_hourly_rate: number;
  is_indoor: boolean;
}

export interface AvailabilitySlot {
  court_id: string;
  start_iso: string;
  end_iso: string;
  start_hour: number;
  end_hour: number;
  date: string;
}

export interface BookingCreateResponse {
  id: string;
  court_id: string;
  time_slot_start: string;
  time_slot_end: string;
  status: string;
}

export async function fetchClubs() {
  return api.get<ApiResponse<Club[]>>('/clubs');
}

export async function fetchCourts(clubId?: string) {
  const params = new URLSearchParams();
  if (clubId) params.set('clubId', clubId);
  const qs = params.toString();
  return api.get<ApiResponse<Court[]>>(`/courts${qs ? `?${qs}` : ''}`);
}

export async function fetchAvailableSlots(clubId: string, courtId: string, date: string) {
  const params = new URLSearchParams({
    clubId,
    courtId,
    from: date,
    to: date,
    duration: '1',
  });

  return api.get<ApiResponse<{ slots: AvailabilitySlot[]; count: number }>>(`/availability?${params.toString()}`);
}

export async function createBooking(courtId: string, startTime: string, endTime: string) {
  return api.post<ApiResponse<BookingCreateResponse>>('/bookings/create', { courtId, startTime, endTime });
}

export async function fetchMyBookings() {
  return api.get<ApiResponse<BookingCreateResponse[]>>('/bookings/my');
}

export async function cancelBooking(bookingId: string) {
  return api.patch<ApiResponse<BookingCreateResponse>>(`/bookings/${bookingId}`, {});
}
