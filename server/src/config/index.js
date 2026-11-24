require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const DEFAULT_JWT_SECRET = 'default_secret_change_me';
const DEFAULT_JWT_REFRESH_SECRET = 'default_refresh_secret_change_me';
const MIN_SECRET_LENGTH = 32;

function parseBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || DEFAULT_JWT_REFRESH_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  nodeEnv,
  isProduction,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  dbPath: process.env.DB_PATH || './data/societycharge.db',

  // Demo mode: seeds sample societies/users with the shared demo password,
  // shows demo logins on the landing/login pages and the admin quick switcher.
  // On by default in development, off by default in production (DEMO_MODE=true to force on).
  demoMode: parseBool(process.env.DEMO_MODE, !isProduction),

  // First super admin for a fresh production database (demo mode off)
  superAdminEmail: (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase(),
  superAdminPassword: process.env.SUPERADMIN_PASSWORD || '',
  superAdminName: process.env.SUPERADMIN_NAME || 'Platform Admin',

  // Charging defaults
  defaultPricePerKwh: 8.0, // INR
  maxBookingDurationHours: 8,
  maxAdvanceBookingDays: 7,

  // Simulated charger defaults
  simulatedChargeRateKwhPerMinute: 0.15, // ~9 kWh/hour for 7.4kW charger
  simulationIntervalMs: 5000, // update every 5 seconds
};

/**
 * Problems with the JWT secrets. In production the server refuses to
 * start while any are present; in development they are only warnings.
 */
config.getSecretProblems = function getSecretProblems() {
  const problems = [];
  const checks = [
    ['JWT_SECRET', process.env.JWT_SECRET, DEFAULT_JWT_SECRET],
    ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET, DEFAULT_JWT_REFRESH_SECRET],
  ];

  for (const [name, value, defaultValue] of checks) {
    if (!value) problems.push(`${name} is not set`);
    else if (value === defaultValue) problems.push(`${name} is still the default value`);
    else if (value.length < MIN_SECRET_LENGTH) problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  return problems;
};

module.exports = config;
