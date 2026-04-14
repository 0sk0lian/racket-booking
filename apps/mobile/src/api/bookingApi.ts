import { api } from './client';
import type { ApiResponse, Booking, CreateBookingInput, Court } from '@racket-booking/shared';

export async function fetchCourts(clubId?: string, sportType?: string) {
  const params = new URLSearchParams();
  if (clubId) params.set('clubId', clubId);
  if (sportType) params.set('sportType', sportType);
  const qs = params.toString();
  return api.get<ApiResponse<Court[]>>(`/courts${qs ? `?${qs}` : ''}`);
}

export async function fetchAvailableSlots(courtId: string, date: string) {
  return api.get<ApiResponse<unknown[]>>(`/courts/${courtId}/availability?date=${date}`);
}

export async function createBooking(input: CreateBookingInput) {
  return api.post<ApiResponse<{ booking: Booking }>>('/bookings', input);
}

export async function fetchMyBookings() {
  return api.get<ApiResponse<Booking[]>>('/bookings/my');
}

export async function cancelBooking(bookingId: string, reason?: string) {
  return api.patch<ApiResponse<Booking>>(`/bookings/${bookingId}/cancel`, { reason });
}
