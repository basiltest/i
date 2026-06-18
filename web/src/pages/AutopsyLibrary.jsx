import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { SECTORS } from '../lib/options';
import Combobox from '../components/Combobox';

export default function AutopsyLibrary() {
  const { session, isAdmin } = useAuth();
  const uid = session?.user?.id;
  const [autopsies, setAutopsies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reading, setReading] = useState(null);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('');
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

  // Esc closes whichever overlay is open; lock body scroll while one is.
  useEffect(() => {
    const open = isModalOpen || reading;
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { setIsModalOpen(false); setReading(null); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModalOpen, reading]);

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
    if (!projectName || !rootCause || !keyLessons || !domain || !category) {
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

  async function deleteAutopsy(autopsy) {
    if (!window.confirm(`Delete "${autopsy.project_name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('idea_autopsies').delete().eq('id', autopsy.id)
    if (error) { console.error(error); alert('Could not delete. Try again.'); return }
    setAutopsies((prev) => prev.filter((a) => a.id !== autopsy.id))
    if (reading?.id === autopsy.id) setReading(null)
  }

  function resetForm() {
    setProjectName('');
    setCategory('');
    setDomain('');
    setDuration('');
    setInvestment('');
    setRootCause('');
    setStory('');
    setKeyLessons('');
    setIsAnonymous(false);
  }


  const filteredAutopsies = autopsies.filter(
    (item) => !selectedCategory || item.category === selectedCategory
  );

  const lessonsOf = (a) =>
    (a.key_lessons || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Idea Autopsy Library</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Post-mortems of failed ideas and startups — what went wrong, and the lessons that
            outlived them.
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          + Share Your Autopsy
        </button>
      </div>

      {/* Category filter — searchable sector picker (empty = all sectors) */}
      <div className="mb-8 border-b border-line pb-5">
        <div className="max-w-xs">
          <Combobox value={selectedCategory} onChange={setSelectedCategory} options={SECTORS} placeholder="All sectors" id="autopsy-sector" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="py-12 text-center text-muted">Loading case studies…</p>
      ) : filteredAutopsies.length === 0 ? (
        <p className="py-12 text-center text-muted">No autopsies found matching the criteria.</p>
      ) : (
        <div className="space-y-5">
          {filteredAutopsies.map((autopsy) => {
            const lessons = lessonsOf(autopsy);
            return (
              <article
                key={autopsy.id}
                className="card p-6 transition-colors hover:border-accent/40"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold text-ink">{autopsy.project_name}</h2>
                  <span className="chip shrink-0">{autopsy.category}</span>
                </div>

                <div className="mb-4 rounded-lg border border-down/20 bg-down/10 p-4">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-down">
                    Why it failed
                  </span>
                  <p className="text-sm font-medium text-ink">{autopsy.root_cause}</p>
                </div>

                {lessons.length > 0 && (
                  <div className="mb-4">
                    <span className="mb-1 block text-sm font-bold text-ink">Key lessons</span>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                      {lessons.slice(0, 3).map((lesson, idx) => (
                        <li key={idx}>{lesson}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>Investment: <strong className="font-semibold text-ink">{autopsy.total_investment || 'N/A'}</strong></span>
                    <span>Duration: <strong className="font-semibold text-ink">{autopsy.duration || 'N/A'}</strong></span>
                    <span>By: <strong className="font-semibold text-ink">{autopsy.is_anonymous ? 'Anonymous' : 'Contributor'}</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    {(autopsy.user_id === uid || isAdmin) && (
                      <button
                        onClick={() => deleteAutopsy(autopsy)}
                        className="flex items-center gap-1 text-faint hover:text-down"
                        aria-label="Delete autopsy"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                    <button
                      onClick={() => setReading(autopsy)}
                      className="font-semibold text-accent hover:underline"
                    >
                      Read full autopsy →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {reading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 animate-fade-in"
          onClick={() => setReading(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${reading.project_name} autopsy`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-7 shadow-pop animate-pop-in"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-ink">{reading.project_name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {reading.category}{reading.domain ? ` · ${reading.domain}` : ''}
                </p>
              </div>
              <button
                onClick={() => setReading(null)}
                className="-mr-1 -mt-1 rounded-full p-2 text-muted transition-colors hover:bg-black/5 hover:text-ink"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <dl className="mb-6 grid grid-cols-3 gap-3 rounded-lg border border-line bg-page/60 p-4 text-center">
              {[
                ['Investment', reading.total_investment || 'N/A'],
                ['Duration', reading.duration || 'N/A'],
                ['Contributor', reading.is_anonymous ? 'Anonymous' : 'Contributor'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="mb-6 rounded-lg border border-down/20 bg-down/10 p-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-down">Root cause</h4>
              <p className="text-sm font-medium text-ink">{reading.root_cause}</p>
            </section>

            {reading.story && (
              <section className="mb-6">
                <h4 className="mb-2 text-sm font-bold text-ink">The story</h4>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted [text-wrap:pretty]">
                  {reading.story}
                </p>
              </section>
            )}

            {lessonsOf(reading).length > 0 && (
              <section>
                <h4 className="mb-2 text-sm font-bold text-ink">Key lessons</h4>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                  {lessonsOf(reading).map((lesson, idx) => (
                    <li key={idx}>{lesson}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Share Your Autopsy modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 animate-fade-in"
          onClick={() => { setIsModalOpen(false); resetForm(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Share your autopsy"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-pop animate-pop-in"
          >
            <h3 className="mb-4 text-xl font-bold text-ink">Share Your Idea Autopsy</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Project name *</label>
                  <input
                    type="text" required value={projectName} onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. QuickDrop" className="input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Category *</label>
                  <Combobox value={category} onChange={setCategory} options={SECTORS} placeholder="Select sector..." id="autopsy-cat" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Domain *</label>
                  <input
                    type="text" required value={domain} onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. Marketplace" className="input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Duration</label>
                  <input
                    type="text" value={duration} onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 18 months" className="input"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Total investment</label>
                <input
                  type="text" value={investment} onChange={(e) => setInvestment(e.target.value)}
                  placeholder="e.g. $500k or 500 hours" className="input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Root cause of failure *</label>
                <input
                  type="text" required value={rootCause} onChange={(e) => setRootCause(e.target.value)}
                  placeholder="One sentence summary of why it failed" className="input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">The story</label>
                <textarea
                  rows="3" value={story} onChange={(e) => setStory(e.target.value)}
                  placeholder="What happened, in detail?" className="input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Key lessons (one per line) *</label>
                <textarea
                  rows="3" required value={keyLessons} onChange={(e) => setKeyLessons(e.target.value)}
                  placeholder={'Lesson 1\nLesson 2'} className="input"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded accent-accent"
                />
                <span className="text-sm font-medium text-ink">Post this autopsy anonymously</span>
              </label>

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Submitting…' : 'Submit Autopsy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
