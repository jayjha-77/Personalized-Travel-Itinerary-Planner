import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function PreferenceForm({ onSubmit }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelers: 1,
    budget: 'Medium',
    travelStyle: 'Relaxed',
    dietaryNeeds: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md text-gray-800"
    >
      <h2 className="text-2xl font-bold mb-4">Plan Your Trip - Step {step} of 3</h2>
      
      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium">Destination</label>
              <input 
                type="text" 
                name="destination" 
                value={formData.destination} 
                onChange={handleChange} 
                placeholder="e.g., Paris, Tokyo" 
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium">Start Date</label>
                <input 
                  type="date" 
                  name="startDate" 
                  value={formData.startDate} 
                  onChange={handleChange} 
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block font-medium">End Date</label>
                <input 
                  type="date" 
                  name="endDate" 
                  value={formData.endDate} 
                  onChange={handleChange} 
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
            </div>
            <button 
              type="button" 
              onClick={nextStep} 
              className="w-full bg-blue-600 text-white p-2 rounded mt-4"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium">Number of Travelers</label>
              <input 
                type="number" 
                name="travelers" 
                min="1" 
                value={formData.travelers} 
                onChange={handleChange} 
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block font-medium">Budget Level</label>
              <select 
                name="budget" 
                value={formData.budget} 
                onChange={handleChange} 
                className="w-full p-2 border rounded"
              >
                <option value="Low">Budget-friendly</option>
                <option value="Medium">Moderate</option>
                <option value="High">Luxury</option>
              </select>
            </div>
            <div className="flex gap-4 mt-4">
              <button 
                type="button" 
                onClick={prevStep} 
                className="w-1/2 bg-gray-300 p-2 rounded"
              >
                Back
              </button>
              <button 
                type="button" 
                onClick={nextStep} 
                className="w-1/2 bg-blue-600 text-white p-2 rounded"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium">Travel Style / Pace</label>
              <select 
                name="travelStyle" 
                value={formData.travelStyle} 
                onChange={handleChange} 
                className="w-full p-2 border rounded"
              >
                <option value="Relaxed">Relaxed & Leisurely</option>
                <option value="Balanced">Balanced</option>
                <option value="Packed">Action-Packed</option>
              </select>
            </div>
            <div>
              <label className="block font-medium">Dietary Preferences / Restrictions</label>
              <input 
                type="text" 
                name="dietaryNeeds" 
                value={formData.dietaryNeeds} 
                onChange={handleChange} 
                placeholder="e.g., Vegetarian, Gluten-free" 
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="flex gap-4 mt-4">
              <button 
                type="button" 
                onClick={prevStep} 
                className="w-1/2 bg-gray-300 p-2 rounded"
              >
                Back
              </button>
              <button 
                type="submit" 
                className="w-1/2 bg-green-600 text-white p-2 rounded"
              >
                Submit Preferences
              </button>
            </div>
          </div>
        )}
      </form>
    </motion.div>
  );
}