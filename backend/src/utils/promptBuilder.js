export function buildTravelPrompt(preferences) {
  const {
    destination,
    startDate,
    endDate,
    travelers,
    budget,
    travelStyle,
    dietaryNeeds
  } = preferences;

  return `
You are an expert AI travel planner. Create a personalized, day-by-day travel itinerary based on the following user specifications:

- **Destination:** ${destination}
- **Travel Dates:** ${startDate} to ${endDate}
- **Number of Travelers:** ${travelers || 'Not specified'}
- **Budget Level:** ${budget || 'Moderate'}
- **Travel Style/Interests:** ${Array.isArray(travelStyle)
  ? travelStyle.join(', ')
  : travelStyle || 'General sightseeing'}
- **Dietary Restrictions:** ${dietaryNeeds || 'None'}

Please return the output as valid JSON containing:
1. "tripOverview": A brief summary of the trip.
2. "dailyItinerary": An array of objects for each day including date, morning activity, afternoon activity, evening activity, and dining recommendations matching the dietary needs.
  `.trim();
}