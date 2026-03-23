/**
 * Creates a minimal Express app for integration testing.
 * Mounts only the routes needed for testing without starting Socket.io,
 * WebSocket, or any real external connections.
 */
import express from 'express';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';

export function createTestApp(...routeEntries) {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'Test server OK' });
  });

  // Mount provided routes
  for (const [path, router] of routeEntries) {
    app.use(path, router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
