
import { z } from 'zod';
import {
  askGroq,
  recommendationsSchema,
  itinerarySchema,
} from './groqTravelService.js';

const today = () => new Date().toISOString().slice(0, 10);

export const preferenceSchema = z.object({
  destination: z.string().trim().max(120).default(''),
  destinationPreference: z.string().optional(),
  origin: z.string().trim().max(120).default(''),
  startDate: z.string().date(),
  endDate: z.string().date(),
  travelers: z.coerce.number().int().min(1).max(20).default(1),
  budget: z.coerce.number().finite().min(0).max(100_000_000).default(20000),
  currency: z.string().length(3).default('INR'),
  travelStyle: z.enum(['Relaxed', 'Balanced', 'Packed']).default('Balanced'),
  interests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  dietaryNeeds: z.string().trim().max(250).default(''),
  vibe: z.string().trim().max(80).default('local culture'),
}).superRefine((data, ctx) => {
  if (data.endDate < data.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must be on or after the start date.',
    });
  }

  const start = new Date(`${data.startDate}T00:00:00Z`);
  const end = new Date(`${data.endDate}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000) + 1;

  if (days > 31) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'Trips cannot exceed 31 calendar days.',
    });
  }
});

function preferenceContext(p) {
  return JSON.stringify({
    origin: p.origin || 'Not specified',
    destination: p.destination || 'Recommend destinations',
    startDate: p.startDate,
    endDate: p.endDate,
    travelers: p.travelers,
    totalBudget: p.budget,
    currency: p.currency,
    travelPace: p.travelStyle,
    interests: p.interests,
    dietaryNeeds: p.dietaryNeeds || 'Not specified',
    vibe: p.vibe,
  });
}

export async function recommendDestinations(preferences) {
  const result = await askGroq({
    system: `You are a careful travel recommendation assistant.
Recommend 3 to 5 distinct destinations that fit the user's origin,
dates, total budget, group size, interests, pace, dietary needs, and vibe.
Return every field required by the supplied JSON schema.
Use the requested currency. Budget figures are estimates, not live quotes.
Explain important assumptions and practical caveats.
Do not invent live availability, opening hours, or verified prices.
Return only a valid JSON object with exactly these top-level fields:
- summary: string
- destinations: array containing 3 to 5 destination objects
- assumptions: array of strings

Each destination must match the supplied schema.
Do not wrap the JSON in Markdown code fences.
Do not return a different top-level structure.`,
    user: JSON.stringify({
      ...JSON.parse(preferenceContext(preferences)),
      instruction:
        'Recommend 3 to 5 destinations matching these travel preferences. Return every field required by the supplied schema.',
    }),
    schema: recommendationsSchema,
    temperature: 0.5,
    maxTokens: 3500,
    strictSchema: true,
  });

  return result;
}

function dateCount(startDate, endDate) {
  return Math.round(
    (
      Date.parse(`${endDate}T00:00:00Z`) -
      Date.parse(`${startDate}T00:00:00Z`)
    ) / 86_400_000,
  ) + 1;
}

async function buildDailyItinerary(preferences, destination) {
  const result = await askGroq({
   system: `You are a careful travel itinerary planner.

Return one JSON object that exactly matches the supplied JSON schema.
The schema is the source of truth for every field name and data type.

Generate:
- destination: the selected destination
- tripOverview: a concise overview of the trip
- vibeSummary: how the itinerary matches the user's preferences
- budgetSummary: currency, estimatedTotal, and notes
- dailyItinerary: one entry for every date from startDate through endDate
- caveats: practical limitations and assumptions

Every daily itinerary entry must contain:
dayNumber, date, title, summary, estimatedCost, and activities.

Every activity must match the supplied activity schema.
Use startTime and endTime in HH:MM format.
Use durationMinutes, estimatedCost, and location.
Do not substitute fields such as time, cost, itinerary, or dailyBudget
for the field names required by the schema.

Respect the user's budget, group size, interests, dietary needs,
travel pace, and vibe.
All prices are estimates. Never claim live verification.
Return only JSON. Do not use Markdown fences.`,
    user: JSON.stringify({
      ...JSON.parse(preferenceContext(preferences)),
      selectedDestination: destination,
      instruction:
        'Generate the full itinerary, including budget summary and caveats.',
    }),
    schema: itinerarySchema,
    temperature: 0.4,
    maxTokens: 6000,
    strictSchema: true,
  });

  if (
    result.dailyItinerary.length !==
    dateCount(preferences.startDate, preferences.endDate)
  ) {
    throw Object.assign(
      new Error(
        'The generated itinerary does not cover every trip date. Please retry.',
      ),
      { status: 502, code: 'AI_INVALID_RESPONSE' },
    );
  }

  return result;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function optimizeRouteAndTimes(itinerary) {
  const optimizationNotes = [
    'Activities are arranged by start time and overlapping activities are rescheduled.',
    'Transfer durations are estimates, not live traffic or routing data.',
  ];

  const dailyItinerary = itinerary.dailyItinerary.map((day) => {
    const activities = [...day.activities].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
    );

    let previousEnd = 8 * 60;

    const adjustedActivities = activities.map((activity, index) => {
      const duration = activity.durationMinutes;
      const requestedStart = toMinutes(activity.startTime);

      const transfer = index === 0
        ? 0
        : (activity.travelMinutesFromPrevious ?? 15);

      // Avoid overlapping activities and account for estimated transfers.
      const start = Math.max(requestedStart, previousEnd + transfer);
      const end = start + duration;

      previousEnd = end;

      return {
        ...activity,
        startTime: toTime(start),
        endTime: toTime(end),
        durationMinutes: duration,
        travelMinutesFromPrevious: index === 0 ? 0 : transfer,
        sortOrder: index + 1,
      };
    });

    if (previousEnd > 22 * 60) {
      optimizationNotes.push(
        `Day ${day.dayNumber} runs late after overlap correction; review the schedule.`,
      );
    }

    return {
      ...day,
      activities: adjustedActivities,
    };
  });

  return {
    ...itinerary,
    dailyItinerary,
    optimizationNotes,
  };
}

export function applyVibePersonalization(itinerary, preferences) {
  const vibe = preferences.vibe || 'local culture';
  const pace = preferences.travelStyle || 'Balanced';

  const dailyItinerary = itinerary.dailyItinerary.map((day) => ({
    ...day,
    activities: day.activities.map((activity) => ({
      ...activity,
      personalizationNote: activity.personalizationNote ||
        `Selected for your ${vibe} vibe and ${pace.toLowerCase()} travel pace.`,
    })),
  }));

  return {
    ...itinerary,
    vibeSummary: itinerary.vibeSummary ||
      `Planned around your ${vibe} preferences at a ${pace.toLowerCase()} pace.`,
    dailyItinerary,
  };
}

export async function generateFullItinerary(
  preferences,
  selectedDestination,
) {
  const destination = selectedDestination || preferences.destination;

  if (!destination) {
    throw Object.assign(
      new Error('Select a destination before generating an itinerary.'),
      { status: 400, code: 'DESTINATION_REQUIRED' },
    );
  }

  const baseItinerary = await buildDailyItinerary(
    preferences,
    destination,
  );

  const optimizedItinerary = optimizeRouteAndTimes(baseItinerary);

  return applyVibePersonalization(
    optimizedItinerary,
    preferences,
  );
}
