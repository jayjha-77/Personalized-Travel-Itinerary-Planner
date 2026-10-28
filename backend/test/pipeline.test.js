import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceSchema, optimizeRouteAndTimes } from '../src/services/itineraryPipeline.js';

test('preference validation accepts valid multi-day INR trip', () => {
  const result = preferenceSchema.safeParse({ startDate: '2026-11-15', endDate: '2026-11-18', travelers: 2, budget: 20000, currency: 'INR', travelStyle: 'Balanced', interests: ['Nature'] });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.destination, '');
});

test('preference validation rejects end date before start date', () => {
  const result = preferenceSchema.safeParse({ startDate: '2026-11-18', endDate: '2026-11-15' });
  assert.equal(result.success, false);
});

test('schedule optimizer sorts time blocks and prevents overlap', () => {
  const input = { destination: 'Example', dailyItinerary: [{ dayNumber: 1, date: '2026-11-15', title: 'Day 1', summary: 'Test', estimatedCost: 0, activities: [
    { title: 'Late', description: 'late', category: 'culture', startTime: '11:00', endTime: '12:00', durationMinutes: 120, estimatedCost: 0, location: 'B', travelMinutesFromPrevious: 15 },
    { title: 'Early', description: 'early', category: 'sightseeing', startTime: '09:00', endTime: '10:00', durationMinutes: 60, estimatedCost: 0, location: 'A' },
  ] }] };
  const result = optimizeRouteAndTimes(input);
  assert.equal(result.dailyItinerary[0].activities[0].title, 'Early');
  assert.ok(result.dailyItinerary[0].activities[1].startTime >= '10:00');
  assert.equal(result.dailyItinerary[0].activities[1].sortOrder, 2);
});
