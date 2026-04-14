// ─── VAT Rates (Sweden / Skatteverket) ──────────────────────────

/** Sports facility rental VAT rate for commercial entities */
export const VAT_COURT_RENTAL_COMMERCIAL = 0.06;

/** Non-profit associations with 90%+ non-profit activity are exempt */
export const VAT_COURT_RENTAL_NON_PROFIT = 0;

/** Standard Swedish VAT for digital services / platform fees */
export const VAT_PLATFORM_FEE = 0.25;

/** Standard Swedish VAT for SaaS B2B invoicing */
export const VAT_SAAS_LICENSE = 0.25;

// ─── Elo Defaults ───────────────────────────────────────────────

export const ELO_DEFAULT_RATING = 1000;

export const ELO_K_FACTOR_NEW = 32;       // rating < 2100
export const ELO_K_FACTOR_MID = 24;       // 2100 <= rating <= 2400
export const ELO_K_FACTOR_ESTABLISHED = 16; // rating > 2400

export const ELO_K_THRESHOLD_MID = 2100;
export const ELO_K_THRESHOLD_HIGH = 2400;

// ─── Booking Defaults ───────────────────────────────────────────

/** How many minutes before booking start the access PIN becomes valid */
export const ACCESS_PIN_VALID_BEFORE_MIN = 30;

/** How many minutes after booking end the access PIN remains valid */
export const ACCESS_PIN_VALID_AFTER_MIN = 15;

/** Minutes before booking start to turn on court lights */
export const LIGHTS_ON_BEFORE_MIN = 5;

/** Split payment cutoff: hours before match start to finalize payments */
export const SPLIT_PAYMENT_CUTOFF_HOURS = 2;

// ─── Tournament ─────────────────────────────────────────────────

/** Default total points per Americano match */
export const AMERICANO_DEFAULT_POINTS_PER_MATCH = 32;

// ─── Supported Sports ───────────────────────────────────────────

export const SUPPORTED_SPORTS = ['padel', 'tennis', 'squash', 'badminton'] as const;

// ─── PostgreSQL Error Codes ─────────────────────────────────────

export const PG_EXCLUSION_VIOLATION = '23P01';
export const PG_UNIQUE_VIOLATION = '23505';
