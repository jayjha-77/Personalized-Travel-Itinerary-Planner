import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { buildTravelPrompt } from './utils/promptBuilder.js';
import { preferenceSchema, recommendDestinations, generateFullItinerary } from './services/itineraryPipeline.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid backend environment configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
const env = parsed.data;

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || origin === env.FRONTEND_ORIGIN.replace(/\/$/, '')) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb', strict: true }));

app.get('/', (_req, res) => res.json({ message: 'Welcome to the WanderPlan Travel Planner API', endpoints: ['/api/health', '/api/config-status', '/api/recommend-destinations', '/api/generate-itinerary', '/api/trips/:tripId/generate-itinerary'] }));
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok', service: 'travel-planner-api', environment: env.NODE_ENV, groqConfigured: Boolean(process.env.GROQ_API_KEY) });
});
app.get('/api/config-status', (_req, res) => res.set('Cache-Control', 'no-store').json({ supabaseUrlConfigured: Boolean(env.SUPABASE_URL), supabaseSecretConfigured: Boolean(env.SUPABASE_SECRET_KEY), groqConfigured: Boolean(process.env.GROQ_API_KEY), groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' }));

// Existing simple preference-capture endpoint remains compatible.
app.post('/api/trips', (req, res) => {
  const parsedPreferences = preferenceSchema.safeParse(req.body);
  if (!parsedPreferences.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip preferences.', details: parsedPreferences.error.issues } });
  return res.status(201).json({ message: 'Trip preferences captured successfully', trip: { id: Date.now(), ...parsedPreferences.data, createdAt: new Date().toISOString() } });
});

// Kept for backward compatibility with the original Epic 3.2 prompt endpoint.
app.post('/api/generate-prompt', (req, res) => {
  const checked = preferenceSchema.safeParse(req.body);
  if (!checked.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid travel preferences.', details: checked.error.issues } });
  if (!checked.data.destination) return res.status(400).json({ error: { code: 'DESTINATION_REQUIRED', message: 'Choose a destination before building an itinerary prompt.' } });
  return res.json({ success: true, prompt: buildTravelPrompt(checked.data), metadata: { generatedAt: new Date().toISOString(), version: '2.0' } });
});

app.post('/api/recommend-destinations', async (req, res, next) => {
  const checked = preferenceSchema.safeParse({ ...req.body, destinationPreference: 'recommend' });
  if (!checked.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid travel preferences.', details: checked.error.issues } });
  try {
    const result = await recommendDestinations(checked.data);
    return res.json({ success: true, ...result, generatedAt: new Date().toISOString(), estimatesOnly: true });
  } catch (error) { return next(error); }
});

async function itineraryHandler(req, res, next) {
  const raw = req.body || {};
  const checked = preferenceSchema.safeParse({ ...raw, destination: raw.selectedDestination || raw.destination || '' });
  if (!checked.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid itinerary preferences.', details: checked.error.issues } });
  if (!checked.data.destination) return res.status(400).json({ error: { code: 'DESTINATION_REQUIRED', message: 'Select a destination first.' } });
  try {
    const itinerary = await generateFullItinerary(checked.data, checked.data.destination);
    return res.json({ success: true, tripId: req.params.tripId || null, itinerary, estimatesOnly: true, generatedAt: new Date().toISOString() });
  } catch (error) { return next(error); }
}
app.post('/api/generate-itinerary', itineraryHandler);
app.post('/api/trips/:tripId/generate-itinerary', itineraryHandler);

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('API error:', err.code || err.name, err.message);
  res.status(status).json({ error: { code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'), message: status === 500 ? 'An unexpected server error occurred.' : err.message } });
});
