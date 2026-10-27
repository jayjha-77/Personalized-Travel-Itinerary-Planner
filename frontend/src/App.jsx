import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('Checking API…');
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setApiStatus(`API online · ${data.environment}`))
      .catch(() => setApiStatus('API not reachable — start the backend'));
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && supabase) loadTrips();
    else setTrips([]);
  }, [session]);

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true); setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setMessage(error ? error.message : 'Check your email for the sign-in link.');
    setLoading(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : 'Signed out.');
  }

  async function loadTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select('id,title,destination_name,start_date,end_date,status,budget,currency')
      .order('start_date', { ascending: true })
      .limit(20);
    if (error) setMessage(`Could not load trips: ${error.message}`);
    else setTrips(data || []);
  }

  if (!supabaseConfigured) {
    return <main className="shell"><section className="hero"><p className="eyebrow">MILESTONE 2 · DATABASE SETUP</p><h1>WanderPlan</h1><p>Connect your Supabase project to activate authentication and trip storage.</p></section><section className="panel"><h2>Configuration required</h2><p>Copy <code>frontend/.env.example</code> to <code>frontend/.env</code> and set your Supabase URL and publishable key. Restart Vite after changing environment variables.</p></section></main>;
  }

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="brand-icon">✦</span> WanderPlan</div><span className="status"><i />{apiStatus}</span></header>
      <section className="hero">
        <p className="eyebrow">YOUR NEXT ADVENTURE STARTS HERE</p>
        <h1>Travel plans that<br /><em>feel like you.</em></h1>
        <p className="hero-copy">A secure foundation for thoughtful, personalized trips. Preferences and AI-powered itineraries arrive in the next milestones.</p>
        <div className="chips"><span>✧ Your travel style</span><span>⌖ Curated destinations</span><span>◷ Day-by-day plans</span></div>
      </section>
      <section className="panel">
        {!session ? <>
          <div className="panel-heading"><div><p className="eyebrow">GET STARTED</p><h2>Sign in to your planner</h2></div><span className="lock">⌑</span></div>
          <p className="muted">We’ll email you a secure sign-in link. No password required.</p>
          <form onSubmit={signIn} className="signin-form">
            <label htmlFor="email">Email address</label>
            <div className="input-row"><input id="email" type="email" required maxLength="254" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /><button disabled={loading}>{loading ? 'Sending…' : 'Send sign-in link →'}</button></div>
          </form>
        </> : <>
          <div className="panel-heading"><div><p className="eyebrow">YOUR SPACE</p><h2>Your saved trips</h2></div><button className="secondary" onClick={signOut}>Sign out</button></div>
          <p className="muted">Signed in as {session.user.email}</p>
          {trips.length ? <div className="trip-list">{trips.map((trip) => <article className="trip" key={trip.id}><div><strong>{trip.title}</strong><p>{trip.destination_name} · {trip.start_date} – {trip.end_date}</p></div><span className="trip-status">{trip.status}</span></article>)}</div> : <div className="empty"><span>✧</span><strong>Your journey begins here</strong><p>No saved trips yet. The trip builder will be added in Milestone 5.</p></div>}
          <button className="secondary refresh" onClick={loadTrips}>Refresh trips ↻</button>
        </>}
        {message && <p className="message" role="status">{message}</p>}
      </section>
      <footer><span>WanderPlan · Milestone 2</span><span>Built for journeys with intention.</span></footer>
    </main>
  );
}
