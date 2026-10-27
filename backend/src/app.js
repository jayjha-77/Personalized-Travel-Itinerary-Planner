import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Do not print environment values; only report invalid variable names.
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid backend environment configuration: ${names}`);
}
const env = parsed.data;

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb', strict: true }));

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'travel-planner-api',
    environment: env.NODE_ENV,
  });
});

app.get('/api/config-status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    supabaseUrlConfigured: Boolean(env.SUPABASE_URL),
    supabaseSecretConfigured: Boolean(env.SUPABASE_SECRET_KEY),
    // Never return credentials, project keys, or raw env values.
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err, _req, res, _next) => {
  // Avoid returning stack traces or secret-bearing error details to clients.
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status === 500 ? 'An unexpected error occurred.' : 'The request could not be processed.',
    },
  });
});
