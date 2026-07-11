import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import app from '../api/app';
import { initDatabase, closeDatabase } from '../store/database';
import { startEngine, stopEngine } from '../engine/simulator';
import { logger } from '../observability/logger';

const parsedPort = parseInt(process.env.PORT || '3000', 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

async function main() {
  try {
    // 1. Initialize SQLite Database
    initDatabase();

    // 2. Start Simulation Engine background loop
    startEngine();

    // 3. Start Express HTTP Server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, `Bug Zoo Simulator API listening on port ${PORT}`);
    });

    // Graceful Shutdown Handler
    let isShuttingDown = false;
    const shutdown = () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info('Received shutdown signal, terminating gracefully...');
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Stop background generator
        stopEngine();
        // Close SQLite DB connection
        closeDatabase();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force exit after timeout if stuck
      setTimeout(() => {
        logger.error('Force shutting down due to timeout during shutdown');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error({ error }, 'Fatal error during application startup');
    process.exit(1);
  }
}

main();
