import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In test environment, prioritize test env if available
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
}
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-mealrelay-jwt-secret-key-32chars-minimum-needed!',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production'
};

// Validate required production configurations at startup
if (config.isProd) {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-mealrelay-jwt-secret-key-32chars-minimum-needed!') {
    missing.push('JWT_SECRET (a secure, unique production secret is required)');
  }

  if (missing.length > 0) {
    throw new Error(
      `[Startup Error] Missing or insecure required environment variables in production:\n  - ${missing.join('\n  - ')}`
    );
  }
}

