require('dotenv').config();
const path = require('path');

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, process.env.DB_PATH || './data/societycharge.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        cb();
      }
    }
  },
  production: process.env.DATABASE_URL ? {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds')
    },
    pool: { min: 2, max: 10 }
  } : {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, process.env.DB_PATH || './data/societycharge.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        cb();
      }
    }
  }
};
