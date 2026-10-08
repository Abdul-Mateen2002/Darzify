import type { Request, Response } from 'express';
import { createApp } from '../server.js';

const appPromise = createApp({ serveFrontend: false });

export default async function handler(req: Request, res: Response): Promise<void> {
  const requestUrl = new URL(req.url, 'http://localhost');
  const expressPath = requestUrl.searchParams.get('__vercel_path');

  if (!expressPath) {
    res.status(404).json({ success: false, error: 'API route not found' });
    return;
  }

  requestUrl.searchParams.delete('__vercel_path');
  req.url = `/api/${expressPath}${requestUrl.search}`;

  const app = await appPromise;
  app(req, res);
}
