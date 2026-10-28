import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase.js';
import PreferenceForm from './components/PreferenceForm';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export default function App() {
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('Checking API…');
  const [trips, setTrips] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedPreferences, setSelectedPreferences] = useState(null);
  const [itinerary, setItinerary] = useState(null);

  // Check the backend and initialize authentication.
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('API health check failed');
        }
        return response.json();
      })
      .then((data) => {
        setApiStatus(`API online · ${data.environment}`);
      })
      .catch(() => {
        setApiStatus('API not reachable — start the backend');
      });

    if (!supabase) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(`Authentication error: ${error.message}`);
        return;
      }

      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Load trips when the user signs in.
  useEffect(() => {
    if (session && supabase) {
      loadTrips();
    } else {
      setTrips([]);
    }
  }, [session]);

  // Send a passwordless sign-in link to the user's email.
  async function signIn(event) {
    event.preventDefault();

    if (!supabase) {
      setMessage('Supabase is not configured.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Check your email for the sign-in link.');
      }
    } catch (error) {
      setMessage(error.message || 'Could not send the sign-in link.');
    } finally {
      setLoading(false);
    }
  }

  // Sign out the current user.
  async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Signed out.');
    }
  }

  // Retrieve saved trips, including their stored preferences.
  async function loadTrips() {
    if (!supabase || !session) return;

    const { data, error } = await supabase
      .from('trips')
      .select(
        'id,title,destination_name,start_date,end_date,status,budget,currency,preferences'
      )
      .order('start_date', { ascending: true })
      .limit(20);

    if (error) {
      setMessage(`Could not load trips: ${error.message}`);
    } else {
      setTrips(data || []);
    }
  }

  async function deleteTrip(trip) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${trip.title}"?`
  );

  if (!confirmed) return;

  if (!supabase || !session) {
    setMessage('Please sign in before deleting a trip.');
    return;
  }

  setDeletingTripId(trip.id);
  setMessage('');

  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', trip.id)
      .eq('user_id', session.user.id);

    if (error) {
      throw new Error(error.message);
    }

    // Remove the deleted trip from the displayed list.
    setTrips((currentTrips) =>
      currentTrips.filter((item) => item.id !== trip.id)
    );

    setMessage(`"${trip.title}" was deleted successfully.`);
  } catch (error) {
    console.error('Delete trip error:', error);
    setMessage(`Could not delete trip: ${error.message}`);
  } finally {
    setDeletingTripId(null);
  }
}

  async function handleFormSubmit(formData) {
    if (!supabase || !session) {
      setMessage('Please sign in before planning and saving your trip.');
      return;
    }
    setLoading(true);
    setMessage('');
    setRecommendations(null);
    setItinerary(null);
    setSelectedPreferences(formData);
    try {
      if (!formData.destination) {
        const response = await fetch(`${API_BASE}/api/recommend-destinations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Could not recommend destinations.');
        setRecommendations(data);
        setMessage('Choose a destination below to build your personalized itinerary.');
      } else {
        await createItinerary(formData.destination, formData);
      }
    } catch (error) {
      console.error('Trip planning error:', error);
      setMessage(error.message || 'Could not plan this trip.');
    } finally {
      setLoading(false);
    }
  }

  async function createItinerary(destination, preferences = selectedPreferences) {
    if (!preferences) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/generate-itinerary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...preferences, destination, selectedDestination: destination }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Could not generate the itinerary.');
      setItinerary(data.itinerary);
      setRecommendations(null);

      // Persist the selected destination and original preferences after AI generation succeeds.
      const { error: dbError } = await supabase.from('trips').insert([{
        user_id: session.user.id,
        title: `Trip to ${destination}`,
        destination_name: destination,
        start_date: preferences.startDate,
        end_date: preferences.endDate,
        budget: Number(preferences.budget || 0),
        status: 'planned',
        currency: preferences.currency || 'INR',
        preferences: { ...preferences, destination },
      }]);
      if (dbError) console.warn('Itinerary generated but trip could not be saved:', dbError.message);
      setMessage(dbError ? 'Itinerary generated, but saving to your trip list failed: ' + dbError.message : 'Your itinerary is ready and the trip was saved. Cost and transfer figures are estimates.');
      await loadTrips();
    } catch (error) {
      console.error('Itinerary generation error:', error);
      setMessage(error.message || 'Could not generate the itinerary.');
    } finally {
      setLoading(false);
    }
  }

  // Show configuration instructions if Supabase credentials are missing.
  if (!supabaseConfigured) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">MILESTONE 2 · DATABASE SETUP</p>
          <h1>WanderPlan</h1>
          <p>
            Connect your Supabase project to activate authentication and
            trip storage.
          </p>
        </section>

        <section className="panel">
          <h2>Configuration required</h2>
          <p>
            Copy <code>frontend/.env.example</code> to{' '}
            <code>frontend/.env</code> and set your Supabase URL and
            publishable key. Restart Vite after changing environment
            variables.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">✦</span>
          WanderPlan
        </div>

        <span className="status">
          <i />
          {apiStatus}
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR NEXT ADVENTURE STARTS HERE</p>

        <h1>
          Travel plans that
          <br />
          <em>feel like you.</em>
        </h1>

        <p className="hero-copy">
          Activity 3.1: User Preference Capture &amp; Personalized
          Itinerary Builder.
        </p>

        <div className="chips">
          <span>✧ Your travel style</span>
          <span>⌖ Curated destinations</span>
          <span>◷ Day-by-day plans</span>
        </div>
      </section>

      <section className="panel">
        {!session ? (
          <>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">GET STARTED</p>
                <h2>Sign in to your planner</h2>
              </div>

              <span className="lock">⌑</span>
            </div>

            <p className="muted">
              We’ll email you a secure sign-in link. No password required.
            </p>

            <form onSubmit={signIn} className="signin-form">
              <label htmlFor="email">Email address</label>

              <div className="input-row">
                <input
                  id="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <button type="submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Send sign-in link →'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR SPACE</p>
                <h2>Plan Your Trip</h2>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>

            <p className="muted mb-4">
              Signed in as {session.user.email}
            </p>

            {/* Activity 3.1: Preference form integration */}
            <div className="my-6">
              <PreferenceForm onSubmit={handleFormSubmit} disabled={loading} />
              {recommendations && (
                <section className="results-section" aria-live="polite">
                  <p className="eyebrow">YOUR MATCHES</p><h3>Destinations picked for your trip</h3><p className="muted">{recommendations.summary}</p>
                  <div className="destination-grid">
                    {recommendations.destinations.map((destination) => (
                      <article className="destination-card" key={destination.name}>
                        <p className="eyebrow">{destination.region}</p><h4>{destination.name}</h4>
                        <p>{destination.matchReasons.join(' · ')}</p>
                        <strong>{destination.estimatedBudget.currency} {destination.estimatedBudget.min.toLocaleString()}–{destination.estimatedBudget.max.toLocaleString()} {destination.estimatedBudget.perPerson ? 'per person' : 'estimated total'}</strong>
                        <p className="muted">{destination.highlights.join(' · ')}</p>
                        {destination.caveats?.length > 0 && <p className="muted">{destination.caveats.join(' ')}</p>}
                        <button type="button" onClick={() => createItinerary(destination.name)} disabled={loading}>Plan {destination.name} →</button>
                      </article>
                    ))}
                  </div>
                  <p className="muted">Budget estimates are AI-generated, not live quotes. {recommendations.assumptions?.join(' ')}</p>
                </section>
              )}
              {itinerary && (
                <section className="results-section itinerary-results" aria-live="polite">
                  <p className="eyebrow">YOUR WANDERPLAN</p><h3>{itinerary.destination}: your itinerary</h3>
                  <p>{itinerary.tripOverview}</p><p className="muted">{itinerary.vibeSummary}</p>
                  <div className="budget-summary"><strong>Estimated trip cost: {itinerary.budgetSummary.currency} {itinerary.budgetSummary.estimatedTotal.toLocaleString()}</strong><p className="muted">{itinerary.budgetSummary.notes.join(' ')}</p></div>
                  {itinerary.dailyItinerary.map((day) => (
                    <article className="day-card" key={`${day.dayNumber}-${day.date}`}><p className="eyebrow">DAY {day.dayNumber} · {day.date}</p><h4>{day.title}</h4><p>{day.summary}</p>
                      <div className="activity-list">{day.activities.map((activity, index) => <div className="activity-item" key={`${activity.title}-${index}`}><div className="activity-time">{activity.startTime}–{activity.endTime}</div><div><strong>{activity.title}</strong><p>{activity.description}</p><p className="muted">{activity.location} · {activity.durationMinutes} min · {itinerary.budgetSummary.currency} {activity.estimatedCost.toLocaleString()} {activity.travelMinutesFromPrevious ? `· ~${activity.travelMinutesFromPrevious} min transfer` : ''}</p>{activity.personalizationNote && <p className="muted">{activity.personalizationNote}</p>}</div></div>)}</div>
                    </article>
                  ))}
                  <p className="muted">{itinerary.optimizationNotes?.join(' ')}</p>{itinerary.caveats?.length > 0 && <p className="muted">{itinerary.caveats.join(' ')}</p>}
                  <button type="button" className="secondary" onClick={() => { setItinerary(null); setRecommendations(null); }}>Plan another trip</button>
                </section>
              )}
            </div>

            {loading && (
              <p className="muted" role="status">
                Processing your trip…
              </p>
            )}

            {/* Saved trips and their stored preferences */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">
                Your Saved Trips
              </h3>

              {trips.length > 0 ? (
                <div className="trip-list">
                  {trips.map((trip) => (
                    <article className="trip" key={trip.id}>
                      <div>
                        <strong>{trip.title}</strong>

                        <p>
                          {trip.destination_name} · {trip.start_date} –{' '}
                          {trip.end_date}
                        </p>

                        <div className="trip-preferences">
                          <p>
                            <strong>Travelers:</strong>{' '}
                            {trip.preferences?.travelers ??
                              'Not specified'}
                          </p>

                          <p>
                            <strong>Budget level:</strong>{' '}
                            {trip.preferences?.budgetLevel ??
                              'Not specified'}
                          </p>

                          <p>
                            <strong>Travel style:</strong>{' '}
                            {trip.preferences?.travelStyle ??
                              'Not specified'}
                          </p>

                          <p>
                            <strong>Dietary needs:</strong>{' '}
                            {trip.preferences?.dietaryNeeds ||
                              'None specified'}
                          </p>
                        </div>
                      </div>

                    <div className="trip-actions">
                     <span className="trip-status">
                      {trip.status}
                     </span>

                     <button
                      type="button"
                      className="delete-button"
                       onClick={() => deleteTrip(trip)}
                       disabled={deletingTripId === trip.id}
                      >
                      {deletingTripId === trip.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <span>✧</span>
                  <strong>Your journey begins here</strong>
                  <p>
                    No saved trips yet. Submit your preferences above to
                    create one.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="secondary refresh mt-4"
              onClick={loadTrips}
            >
              Refresh trips ↻
            </button>
          </>
        )}

        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
      </section>

      <footer>
        <span>WanderPlan · Milestone 3</span>
        <span>Built for journeys with intention.</span>
      </footer>
    </main>
  );
}
