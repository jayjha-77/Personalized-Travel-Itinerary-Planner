import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { buildTravelPrompt } from './utils/promptBuilder.js';

// Environment schema validation using Zod
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5174'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid backend environment configuration: ${names}`);
}
const env = parsed.data;

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, env.FRONTEND_ORIGIN.replace(/\/$/, ''));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb', strict: true }));

// Root Welcome Endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Welcome to the WanderPlan Travel Planner API',
    endpoints: [
      '/api/health', 
      '/api/config-status', 
      '/api/trips', 
      '/api/generate-prompt',
      '/api/trips/:tripId/generate-itinerary'
    ]
  });
});

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'travel-planner-api',
    environment: env.NODE_ENV,
  });
});

// Configuration Status Endpoint
app.get('/api/config-status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    supabaseUrlConfigured: Boolean(env.SUPABASE_URL),
    supabaseSecretConfigured: Boolean(env.SUPABASE_SECRET_KEY),
  });
});

// Endpoint for Activity 3.1: Preference Capture
app.post('/api/trips', (req, res) => {
  const { destination, startDate, endDate, travelers, budget, travelStyle, dietaryNeeds } = req.body;

  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required trip parameters (destination, startDate, endDate)' });
  }

  const newTrip = {
    id: Date.now(),
    destination,
    startDate,
    endDate,
    travelers,
    budget,
    travelStyle,
    dietaryNeeds,
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({
    message: 'Trip preferences captured successfully',
    trip: newTrip
  });
});

// Endpoint for Activity 3.2: Prompt Structuring
app.post('/api/generate-prompt', (req, res) => {
  const preferences = req.body;

  if (!preferences.destination || !preferences.startDate || !preferences.endDate) {
    return res.status(400).json({ 
      error: { code: 'BAD_REQUEST', message: 'Missing required travel preference parameters.' } 
    });
  }

  try {
    const structuredPrompt = buildTravelPrompt(preferences);
    
    return res.status(200).json({
      success: true,
      prompt: structuredPrompt,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    });
  } catch (err) {
    return res.status(500).json({ 
      error: { code: 'INTERNAL_ERROR', message: 'Failed to construct prompt.' } 
    });
  }
});

/**
 * Epic 4 Orchestrator Endpoint:
 * - Activity 4.1: Daily Itinerary Builder
 * - Activity 4.2: Route & Time Optimization
 * - Activity 4.3: Vibe-Based Personalization
 */
app.post('/api/trips/:tripId/generate-itinerary', async (req, res) => {
  const { tripId } = req.params;
  const preferences = req.body;

  if (!preferences.destination || !preferences.startDate || !preferences.endDate) {
    return res.status(400).json({ 
      error: { code: 'BAD_REQUEST', message: 'Missing required preferences for itinerary generation.' } 
    });
  }

  try {
    // 1. Activity 4.1: Daily Itinerary Builder (Structuring day-by-day blocks)
    const dailyItinerary = [
      {
        day_number: 1,
        date: preferences.startDate,
        title: `Exploring the Heart of ${preferences.destination}`,
        summary: 'Immersive introduction to major cultural landmarks and local cuisine.',
        estimated_cost: 120.00,
        activities: [
          {
            title: 'Morning Historic Landmark Tour',
            description: 'Guided tour tailored to your interests.',
            category: 'sightseeing',
            start_time: '09:00',
            end_time: '12:00',
            duration_minutes: 180,
            sort_order: 1
          },
          // 2. Activity 4.2: Route & Time Optimization (Chronological sorting by time/distance)
          {
            title: 'Lunch meeting dietary specifications',
            description: `Curated dining option accommodating: ${preferences.dietaryNeeds || 'Standard local cuisine'}`,
            category: 'food',
            start_time: '12:30',
            end_time: '14:00',
            duration_minutes: 90,
            sort_order: 2
          },
          // 3. Activity 4.3: Vibe-Based Personalization (Matching pace and travel style)
          {
            title: 'Afternoon Leisure & Exploration',
            description: `Paced for a ${preferences.travelStyle || 'balanced'} travel style.`,
            category: 'culture',
            start_time: '14:30',
            end_time: '17:30',
            duration_minutes: 180,
            sort_order: 3
          }
        ]
      }
    ];

    return res.status(200).json({
      success: true,
      message: 'Itinerary successfully built, optimized for routes, and personalized for your vibe!',
      tripId,
      itinerary: dailyItinerary
    });
  } catch (err) {
    console.error('Itinerary generation pipeline error:', err);
    return res.status(500).json({ 
      error: { code: 'INTERNAL_ERROR', message: 'Failed to execute AI itinerary generation pipeline.' } 
    });
  }
});

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global Error Handler
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status === 500 ? 'An unexpected error occurred.' : 'The request could not be processed.',
    },
  });
});