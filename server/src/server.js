import app from './app.js';
import { config } from './config/index.js';
import prisma from './config/prisma.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`MealRelay Backend running on http://localhost:${PORT} [${config.env}]`);
});

// Graceful shutdown handling
async function shutdown(signal) {
  console.log(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Prisma client disconnected successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnection:', err.message);
      process.exit(1);
    }
  });

  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
