import React, { useState } from 'react';

const interestOptions = ['Nature', 'Food', 'Culture', 'History', 'Adventure', 'Beaches', 'Photography', 'Shopping', 'Relaxation', 'Architecture'];

export default function PreferenceForm({ onSubmit, disabled = false }) {
  const [formData, setFormData] = useState({
    destination: '', origin: '', startDate: '', endDate: '', travelers: 1,
    budget: 20000, currency: 'INR', travelStyle: 'Balanced', interests: ['Nature', 'Food', 'Culture'],
    dietaryNeeds: '', vibe: 'local culture',
  });
  const today = new Date().toISOString().slice(0, 10);
  const update = (event) => setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const toggleInterest = (interest) => setFormData((prev) => ({
    ...prev,
    interests: prev.interests.includes(interest) ? prev.interests.filter((item) => item !== interest) : [...prev.interests, interest],
  }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({ ...formData, travelers: Number(formData.travelers), budget: Number(formData.budget), destination: formData.destination.trim(), origin: formData.origin.trim(), dietaryNeeds: formData.dietaryNeeds.trim() });
  };

  return (
    <form className="preference-form" onSubmit={submit}>
      <p className="eyebrow">EPIC 3.3 · PERSONALIZED RECOMMENDATIONS</p>
      <h3>Where would you like to go?</h3>
      <p className="muted">Leave destination blank and WanderPlan will suggest places that fit your trip.</p>
      <div className="form-grid">
        <label>Destination (optional)<input name="destination" value={formData.destination} onChange={update} placeholder="Leave blank for recommendations" maxLength={120} /></label>
        <label>Starting city (optional)<input name="origin" value={formData.origin} onChange={update} placeholder="e.g. Bhopal, India" maxLength={120} /></label>
        <label>Start date<input type="date" name="startDate" value={formData.startDate} min={today} onChange={update} required /></label>
        <label>End date<input type="date" name="endDate" value={formData.endDate} min={formData.startDate || today} onChange={update} required /></label>
        <label>Travelers<input type="number" name="travelers" min="1" max="20" value={formData.travelers} onChange={update} required /></label>
        <label>Total budget<input type="number" name="budget" min="0" max="100000000" value={formData.budget} onChange={update} required /></label>
        <label>Currency<select name="currency" value={formData.currency} onChange={update}><option value="INR">INR · ₹</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="GBP">GBP · £</option></select></label>
        <label>Travel pace<select name="travelStyle" value={formData.travelStyle} onChange={update}><option value="Relaxed">Relaxed</option><option value="Balanced">Balanced</option><option value="Packed">Packed</option></select></label>
        <label>Trip vibe<select name="vibe" value={formData.vibe} onChange={update}><option value="local culture">Local culture</option><option value="nature and calm">Nature & calm</option><option value="foodie">Foodie</option><option value="adventure">Adventure</option><option value="romantic">Romantic</option><option value="family-friendly">Family-friendly</option><option value="budget explorer">Budget explorer</option><option value="photography">Photography</option></select></label>
        <label>Dietary needs<input name="dietaryNeeds" value={formData.dietaryNeeds} onChange={update} placeholder="e.g. vegetarian, allergies" maxLength={250} /></label>
      </div>
      <fieldset className="interest-fieldset"><legend>What do you enjoy?</legend><div className="interest-options">{interestOptions.map((interest) => <label className="interest-option" key={interest}><input type="checkbox" checked={formData.interests.includes(interest)} onChange={() => toggleInterest(interest)} />{interest}</label>)}</div></fieldset>
      <button type="submit" disabled={disabled}>{disabled ? 'Planning your trip…' : formData.destination ? 'Build my itinerary →' : 'Recommend destinations →'}</button>
    </form>
  );
}
