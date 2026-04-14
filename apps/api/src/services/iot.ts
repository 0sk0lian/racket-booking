import axios from 'axios';
import type { IoTPayload } from '@racket-booking/shared';
import {
  ACCESS_PIN_VALID_BEFORE_MIN,
  ACCESS_PIN_VALID_AFTER_MIN,
  LIGHTS_ON_BEFORE_MIN,
} from '@racket-booking/shared';

const NOX_API_URL = process.env.NOX_API_URL || 'https://api.nox-controllers.com/v1';
const NOX_API_KEY = process.env.NOX_API_KEY || '';

/**
 * Dispatch a command to an IoT hardware device (lighting relay, door keypad).
 * Uses the NOX Controllers API (or similar cloud-to-device webhook).
 *
 * Implements retry with exponential backoff on failure.
 *
 * Reference: docs/ARCHITECTURE.md → "Facility Automation and IoT Integration"
 */
export async function dispatchHardwareCommand(payload: IoTPayload): Promise<unknown> {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${NOX_API_URL}/device/command`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${NOX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      return response.data;
    } catch (error: any) {
      lastError = error;
      console.error(
        `[iot] Attempt ${attempt + 1}/${maxRetries} failed for device ${payload.hardwareId}:`,
        error.message
      );

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`HARDWARE_DISPATCH_FAILED: ${lastError?.message}`);
}

/**
 * Schedule IoT jobs for a confirmed booking:
 *   1. SET_PIN on the door keypad (valid from -30min to +15min of booking)
 *   2. RELAY_ON for court lights (5min before start)
 *   3. RELAY_OFF for court lights (at end time)
 *
 * In production, these should be scheduled via BullMQ delayed jobs
 * rather than in-process timeouts. This implementation shows the logic.
 */
export async function scheduleIoTJobs(booking: {
  id: string;
  court_id: string;
  time_slot: string;
  access_pin: string;
}): Promise<void> {
  // In a real system we'd:
  // 1. Look up the court's hardware_relay_id from the DB
  // 2. Schedule BullMQ delayed jobs at the appropriate timestamps
  // 3. The BullMQ worker would call dispatchHardwareCommand at fire time

  // For now, log the jobs that would be scheduled
  console.log(`[iot] Scheduled jobs for booking ${booking.id}:`);
  console.log(`  - SET_PIN: pin=${booking.access_pin}, valid ${ACCESS_PIN_VALID_BEFORE_MIN}min before to ${ACCESS_PIN_VALID_AFTER_MIN}min after`);
  console.log(`  - RELAY_ON: ${LIGHTS_ON_BEFORE_MIN}min before start`);
  console.log(`  - RELAY_OFF: at booking end`);
}
