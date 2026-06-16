import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AutopsyLibrary() {
  const [autopsies, setAutopsies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('SaaS');
  const [domain, setDomain] = useState('');
  const [duration, setDuration] = useState('');
  const [investment, setInvestment] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [story, setStory] = useState('');
  const [keyLessons, setKeyLessons] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAutopsies();
  }, []);

  async function fetchAutopsies() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('idea_autopsies')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutopsies(data || []);
    } catch (err) {
      console.error('Error fetching autopsies:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!projectName || !rootCause || !keyLessons || !domain) {
      alert('Please fill out all mandatory fields.');
      return;
    }

    try {
      setSubmitting(true);
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('idea_autopsies').insert([
        {
          user_id: userData?.user?.id,
          project_name: projectName,
          category,
          domain,
          duration,
          total_investment: investment,
          root_cause: rootCause,
          story,
          key_lessons: keyLessons,
          is_anonymous: isAnonymous,
          status: 'pending'
        }
      ]);

      if (error) throw error;

      alert('Autopsy submitted successfully! It is now pending admin verification.');
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setProjectName('');
    setCategory('SaaS');
    setDomain('');
    setDuration('');
    setInvestment('');
    setRootCause('');
    setStory('');
    setKeyLessons('');
    setIsAnonymous(false);
  }

  const categories = ['All', 'SaaS', 'EdTech', 'HealthTech', 'FinTech', 'FoodTech', 'Logistics'];
  
  const filteredAutopsies = autopsies.filter(item => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesDom = selectedDomain === 'All' || item.domain.toLowerCase().includes(selectedDomain.toLowerCase());
    return matchesCat && matchesDom;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Idea Autopsy Library</h1>
          <p className="text-gray-600">Learn from failures, avoid common mistakes</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg font-medium shadow transition"
        >
          + Share Your Autopsy
        </button>
      </div>

      {/* Intro Banner Card */}
      <div className="border border-red-300 bg-red-50 text-red-900 p-4 rounded-xl mb-6 flex items-start gap-3">
        <span className="text-xl">📖</span>
        <div>
          <strong className="block font-semibold">What is an Idea Autopsy?</strong>
          <p className="text-sm opacity-90">
            A post-mortem analysis of failed ideas and startups. Learn from others' mistakes, understand what went wrong, and avoid similar pitfalls in your own journey.
          </p>
        </div>
      </div>

      {/* Category Pill Filters */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              selectedCategory === cat 
                ? 'bg-blue-900 text-white border-blue-900' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main List Rendering */}
      {loading ? (
        <p className="text-center text-gray-500">Loading case studies...</p>
      ) : filteredAutopsies.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No autopsies found matching the criteria.</p>
      ) : (
        <div className="space-y-6">
          {filteredAutopsies.map(autopsy => (
            <div key={autopsy.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative">
              <span className="absolute top-6 right-6 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-200">
                {autopsy.category}
              </span>
              
              <h2 className="text-xl font-bold text-gray-900 mb-2">{autopsy.project_name}</h2>
              
              {/* Highlight Metrics Box */}
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
                <span className="text-red-700 font-bold text-sm block mb-1">Why it failed:</span>
                <p className="text-gray-800 text-sm font-medium">{autopsy.root_cause}</p>
              </div>

              {/* Key Lessons Rendered */}
              <div className="mb-4">
                <span className="text-gray-700 font-bold text-sm block mb-1">Key Lessons:</span>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  {autopsy.key_lessons.split('\n').map((lesson, idx) => (
                    <li key={idx}>{lesson}</li>
                  ))}
                </ul>
              </div>

              {/* Card Meta Footer */}
              <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 border-t pt-4 mt-4">
                <div className="flex gap-4">
                  <span>Investment: <strong className="text-gray-700">{autopsy.total_investment || 'N/A'}</strong></span>
                  <span>Duration: <strong className="text-gray-700">{autopsy.duration || 'N/A'}</strong></span>
                  <span>By: <strong className="text-gray-700">{autopsy.is_anonymous ? 'Anonymous User' : 'Contributor'}</strong></span>
                </div>
                <button className="text-indigo-600 font-semibold hover:underline">Read Full Autopsy →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wireframe 2 Modal Form: Share Your Autopsy */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Share Your Idea Autopsy</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Project Name *</label>
                  <input 
                    type="text" required value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="e.g. QuickDrop" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Category *</label>
                  <select 
                    value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Domain *</label>
                  <input 
                    type="text" required value={domain} onChange={e => setDomain(e.target.value)}
                    placeholder="e.g. Marketplace" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Duration</label>
                  <input 
                    type="text" value={duration} onChange={e => setDuration(e.target.value)}
                    placeholder="e.g. 18 months" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Total Investment</label>
                <input 
                  type="text" value={investment} onChange={e => setInvestment(e.target.value)}
                  placeholder="e.g. $500k or 500 hours" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Root Cause of Failure *</label>
                <input 
                  type="text" required value={rootCause} onChange={e => setRootCause(e.target.value)}
                  placeholder="One sentence summary of why it failed" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">The Story</label>
                <textarea 
                  rows="3" value={story} onChange={e => setStory(e.target.value)}
                  placeholder="What happened in detail?" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Key Lessons (One per line) *</label>
                <textarea 
                  rows="3" required value={keyLessons} onChange={e => setKeyLessons(e.target.value)}
                  placeholder="Lesson 1&#10;Lesson 2" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" id="anon" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="anon" className="text-sm text-gray-700 font-medium cursor-pointer">Post this autopsy anonymously</label>
              </div>

              {/* Form Controls */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Autopsy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}