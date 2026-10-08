import type { Request, Response } from 'express';
import { createApp } from '../server.js';

const appPromise = createApp({ serveFrontend: false });

export default async function handler(req: Request, res: Response): Promise<void> {
  const app = await appPromise;
  app(req, res);
}
