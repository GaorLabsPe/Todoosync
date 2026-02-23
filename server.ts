import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Import API handlers
import loginHandler from './api/v1/auth/login.ts';
import logoutHandler from './api/v1/auth/logout.ts';
import meHandler from './api/v1/auth/me.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies for API routes
  app.use(express.json());

  // Mount API routes for local development
  app.all('/api/v1/auth/login', (req, res) => loginHandler(req as any, res as any));
  app.all('/api/v1/auth/logout', (req, res) => logoutHandler(req as any, res as any));
  app.all('/api/v1/auth/me', (req, res) => meHandler(req as any, res as any));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
