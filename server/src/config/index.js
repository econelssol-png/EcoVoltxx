require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'default_secret_change_me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  dbPath: process.env.DB_PATH || './data/societycharge.db',

  // Charging defaults
  defaultPricePerKwh: 8.0, // INR
  maxBookingDurationHours: 8,
  maxAdvanceBookingDays: 7,

  // Simulated charger defaults
  simulatedChargeRateKwhPerMinute: 0.15, // ~9 kWh/hour for 7.4kW charger
  simulationIntervalMs: 5000, // update every 5 seconds
};
