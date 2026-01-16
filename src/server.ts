/**
 * Website Plunder Server
 *
 * A simple web application that converts public websites
 * into single downloadable HTML files.
 */

import express from 'express';
import * as path from 'path';
import plunderRouter from './routes/plunder';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/plunder', plunderRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   ⚓ Website Plunder v1.0.0                       ║
║                                                   ║
║   Server running at http://localhost:${PORT}         ║
║                                                   ║
║   Ready to plunder the seven seas of the web!    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
