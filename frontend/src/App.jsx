
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

  // Save the trip and its preferences, then generate the structured prompt.
  async function handleFormSubmit(formData) {
    if (!supabase || !session) {
      setMessage('Please sign in before saving your trip.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 1. Convert the selected budget level to a numeric database value.
      const budgetMapping = {
        Low: 500,
        Medium: 1500,
        High: 5000,
      };

      const numericBudget = budgetMapping[formData.budget] ?? 1500;

      // 2. Save the trip and all form preferences in Supabase.
      const { data: savedTrip, error: dbError } = await supabase
        .from('trips')
        .insert([
          {
            user_id: session.user.id,
            title: `Trip to ${formData.destination.trim()}`,
            destination_name: formData.destination.trim(),
            start_date: formData.startDate,
            end_date: formData.endDate,
            budget: numericBudget,
            status: 'planned',
            currency: 'USD',

            // These preferences are stored together as JSONB.
            preferences: {
              destination: formData.destination.trim(),
              startDate: formData.startDate,
              endDate: formData.endDate,
              travelers: Number(formData.travelers),
              budgetLevel: formData.budget,
              travelStyle: formData.travelStyle,
              dietaryNeeds: formData.dietaryNeeds.trim(),
            },
          },
        ])
        .select()
        .single();

      if (dbError) {
        throw new Error(
          `Failed to save trip to database: ${dbError.message}`
        );
      }

      // 3. Generate the structured travel prompt using the backend.
      const promptResponse = await fetch(
        `${API_BASE}/api/generate-prompt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!promptResponse.ok) {
        let details = '';

        try {
          const responseData = await promptResponse.json();
          details =
            responseData.error?.message ||
            responseData.error ||
            '';
        } catch {
          // The server may return a response without JSON.
        }

        throw new Error(
          `Trip saved, but prompt generation failed${
            details ? `: ${details}` : '.'
          }`
        );
      }

      setMessage(
        'Trip preferences saved and AI prompt structured successfully!'
      );

      // 4. Refresh the list so the newly saved trip appears immediately.
      await loadTrips();
    } catch (error) {
      console.error('Trip submission error:', error);
      setMessage(
        error.message ||
          'An error occurred while processing your trip preferences.'
      );

      // The trip may already have been saved if prompt generation failed.
      // Refresh the list to show the actual database state.
      await loadTrips();
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
              <PreferenceForm onSubmit={handleFormSubmit} />
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
