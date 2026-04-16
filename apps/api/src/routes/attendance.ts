/**
 * Attendance API.
 *
 *   GET    /api/bookings/:id/attendance                    — list rows
 *   POST   /api/bookings/:id/attendance/:userId            — set one user's status
 *   POST   /api/bookings/:id/attendance/bulk               — bulk move users into one status
 *   POST   /api/bookings/:id/checkin/:userId               — convenience: mark present
 *   POST   /api/bookings/:id/no-show/:userId               — convenience: mark no_show
 *   GET    /api/users/:id/attendance/upcoming              — what is this user invited to
 *
 * All `setStatus` mutations may also auto-promote the next waitlist entry; that
 * promoted row is returned alongside in the response payload so callers can
 * notify the user (push, email, etc) downstream.
 */
import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { setStatus, bulkSet, listForBooking, listForUser, RsvpStatus } from '../services/attendance.js';

export const bookingAttendanceRoutes = Router();
export const userAttendanceRoutes = Router();

const VALID: RsvpStatus[] = ['invited', 'going', 'declined', 'waitlist', 'present', 'no_show'];

function ensureBooking(bookingId: string, res: Response): boolean {
  if (!store.bookings.find(b => b.id === bookingId)) {
    res.status(404).json({ success: false, error: 'Booking not found' });
    return false;
  }
  return true;
}

// ─── List per booking ────────────────────────────────────────────

bookingAttendanceRoutes.get('/:id/attendance', (req: Request, res: Response) => {
  if (!ensureBooking(String(req.params.id), res)) return;
  res.json({ success: true, data: listForBooking(String(req.params.id)) });
});

// ─── Bulk move (registered BEFORE /:userId so 'bulk' isn't captured as a userId) ───

bookingAttendanceRoutes.post('/:id/attendance/bulk', (req: Request, res: Response) => {
  if (!ensureBooking(String(req.params.id), res)) return;
  const status = req.body?.status as RsvpStatus | undefined;
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds as string[] : null;
  if (!status || !VALID.includes(status) || !userIds) {
    res.status(400).json({ success: false, error: `body must be { status, userIds[] }` });
    return;
  }
  const result = bulkSet(String(req.params.id), userIds, status);
  res.json({ success: true, data: result });
});

// ─── Set one user's status ───────────────────────────────────────

bookingAttendanceRoutes.post('/:id/attendance/:userId', (req: Request, res: Response) => {
  if (!ensureBooking(String(req.params.id), res)) return;
  const status = req.body?.status as RsvpStatus | undefined;
  if (!status || !VALID.includes(status)) {
    res.status(400).json({ success: false, error: `status must be one of ${VALID.join(', ')}` });
    return;
  }
  const checkedInBy = typeof req.body?.checkedInBy === 'string' ? req.body.checkedInBy : undefined;
  const result = setStatus(String(req.params.id), String(req.params.userId), status, { checked_in_by: checkedInBy });
  res.json({ success: true, data: result });
});

// ─── Convenience: check-in ────────────────────────────────────────

bookingAttendanceRoutes.post('/:id/checkin/:userId', (req: Request, res: Response) => {
  if (!ensureBooking(String(req.params.id), res)) return;
  const checkedInBy = typeof req.body?.checkedInBy === 'string' ? req.body.checkedInBy : undefined;
  const result = setStatus(String(req.params.id), String(req.params.userId), 'present', { checked_in_by: checkedInBy });
  res.json({ success: true, data: result });
});

bookingAttendanceRoutes.post('/:id/no-show/:userId', (req: Request, res: Response) => {
  if (!ensureBooking(String(req.params.id), res)) return;
  const checkedInBy = typeof req.body?.checkedInBy === 'string' ? req.body.checkedInBy : undefined;
  const result = setStatus(String(req.params.id), String(req.params.userId), 'no_show', { checked_in_by: checkedInBy });
  res.json({ success: true, data: result });
});

// ─── User-side: upcoming attendance ──────────────────────────────

userAttendanceRoutes.get('/:id/attendance/upcoming', (req: Request, res: Response) => {
  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  res.json({ success: true, data: listForUser(String(req.params.id), since) });
});
