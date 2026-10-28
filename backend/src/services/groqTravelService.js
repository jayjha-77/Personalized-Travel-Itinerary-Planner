import { z } from 'zod';

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
});

const destinationSchema = z.object({
  name: z.string().min(1).max(100),
  region: z.string().min(1).max(120),
  matchReasons: z.array(z.string().min(1)).min(1).max(5),
  highlights: z.array(z.string().min(1)).min(1).max(6),
  recommendedDays: z.number().int().min(1).max(30),
  estimatedBudget: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    currency: z.string().length(3),
    perPerson: z.boolean(),
    includesTravel: z.boolean(),
  }),
  bestFor: z.array(z.string()).max(8),
  caveats: z.array(z.string()).max(5),
});

export const recommendationsSchema = z.object({
  summary: z.string().min(1).max(600),
  destinations: z.array(destinationSchema).min(3).max(5),
  assumptions: z.array(z.string()).max(8),
});

const activitySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  category: z.enum(['sightseeing', 'food', 'nature', 'culture', 'adventure', 'relaxation', 'shopping', 'transport', 'other']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(720),
  estimatedCost: z.number().nonnegative(),
  location: z.string().min(1).max(160),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  travelMinutesFromPrevious: z.number().int().min(0).max(360).optional(),
  personalizationNote: z.string().max(240).optional(),
});

export const itinerarySchema = z.object({
  destination: z.string().min(1).max(120),
  tripOverview: z.string().min(1).max(1000),
  vibeSummary: z.string().min(1).max(500),
  budgetSummary: z.object({ currency: z.string().length(3), estimatedTotal: z.number().nonnegative(), notes: z.array(z.string()).max(8) }),
  dailyItinerary: z.array(z.object({
    dayNumber: z.number().int().min(1).max(31),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(500),
    estimatedCost: z.number().nonnegative(),
    activities: z.array(activitySchema).min(1).max(8),
  })).min(1).max(31),
  caveats: z.array(z.string()).max(10),
});

function parseJsonContent(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); }
  catch { throw new Error('Groq returned invalid JSON. Please retry.'); }
}

function makeGroqStrictSchema(schema) {
  const jsonSchema = z.toJSONSchema(schema);

  // Groq doesn't need the JSON Schema draft declaration.
  delete jsonSchema.$schema;

  function enforceStrictRules(node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'object' && node.properties) {
      node.additionalProperties = false;
      node.required = Object.keys(node.properties);
    }

    // Groq's supported schema subset may not accept these
    // string-length keywords. Zod will validate them afterward.
    delete node.minLength;
    delete node.maxLength;

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(enforceStrictRules);
      } else if (value && typeof value === 'object') {
        enforceStrictRules(value);
      }
    }
  }

  enforceStrictRules(jsonSchema);
  return jsonSchema;
}

export async function askGroq({
  system,
  user,
  schema,
  temperature = 0.3,
  maxTokens = 6000,
  strictSchema = false,
}) {
  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    throw Object.assign(new Error('Groq is not configured. Set GROQ_API_KEY in backend/.env.'), { status: 503, code: 'AI_NOT_CONFIGURED' });
  }
  const { GROQ_API_KEY, GROQ_MODEL } = parsedEnv.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const responseFormat = strictSchema
  ? {
      type: 'json_schema',
      json_schema: {
        name: 'travel_response',
        strict: true,
        schema: makeGroqStrictSchema(schema),
      },
    }
  : { type: 'json_object' };
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature,
        response_format: responseFormat,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: `${system}\nReturn ONLY one valid JSON object. Do not use markdown fences. Never claim that prices, opening hours, routes, or availability were live-verified.` },
          { role: 'user', content: user },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `Groq request failed (${response.status}).`;
      const status = response.status === 429 ? 503 : (response.status >= 500 ? 502 : 502);
      throw Object.assign(new Error(message), { status, code: 'AI_PROVIDER_ERROR' });
    }
    const choice = payload?.choices?.[0];
const content = choice?.message?.content;

console.log('Groq response metadata:', {
  model: payload?.model,
  finishReason: choice?.finish_reason,
  contentType: typeof content,
});

if (typeof content !== 'string' || !content.trim()) {
  console.error('Groq returned no usable content:', JSON.stringify(payload, null, 2));

  throw Object.assign(
    new Error('Groq returned an empty response. Please retry.'),
    { status: 502, code: 'AI_EMPTY_RESPONSE' }
  );
}

console.log('Groq raw content:', content);

const parsed = parseJsonContent(content);
const result = schema.safeParse(parsed);

if (!result.success) {
  console.error(
    'Groq schema validation failed:',
    JSON.stringify(result.error.issues, null, 2)
  );

  console.error(
    'Parsed Groq response:',
    JSON.stringify(parsed, null, 2)
  );

  throw Object.assign(
    new Error('AI returned a response that did not match the required format. Please retry.'),
    { status: 502, code: 'AI_INVALID_RESPONSE' }
  );
}

return result.data;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('AI request timed out. Please try again.'), { status: 504, code: 'AI_TIMEOUT' });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { destinationSchema };
