import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { 
  HelpCircle, PlusCircle, AlertCircle, Calendar, 
  User, Layers, Send, CheckCircle2, Award, FileText 
} from 'lucide-react';

export default function ProblemHub() {
  const { user } = useAuth();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProblemId, setActiveProblemId] = useState(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [domainTags, setDomainTags] = useState([]);
  const [postedByRole, setPostedByRole] = useState('faculty');
  const [deadline, setDeadline] = useState('');

  const [solutionTitle, setSolutionTitle] = useState('');
  const [solutionDesc, setSolutionDesc] = useState('');
  const [courseContext, setCourseContext] = useState('');

  const [selectedSolutionId, setSelectedSolutionId] = useState(null);
  const [impactScore, setImpactScore] = useState(5);
  const [feasibilityScore, setFeasibilityScore] = useState(5);

  const userRole = user?.user_metadata?.role || 'Student';
  const isManagement = userRole === 'Mentor' || userRole === 'Admin' || userRole === 'Super Admin';

  useEffect(() => {
    fetchProblemsAndSolutions();
  }, []);

  async function fetchProblemsAndSolutions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('problems')
        .select(`*, problem_solutions(*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProblems(data || []);
      if (data && data.length > 0 && !activeProblemId) {
        setActiveProblemId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePostProblem(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return alert('Please enter a title and description.');

    try {
      const { error } = await supabase.from('problems').insert({
        user_id: user.id,
        title,
        description,
        domain_tags: domainTags,
        posted_by_name: user.user_metadata?.full_name || 'Stakeholder Owner',
        posted_by_role: postedByRole,
        deadline: deadline ? new Date(deadline).toISOString() : null
      });

      if (error) throw error;
      setIsFormOpen(false);
      setTitle(''); setDescription(''); setDomainTags([]); setDeadline('');
      fetchProblemsAndSolutions();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handlePostSolution(problemId) {
    if (!solutionTitle.trim() || !solutionDesc.trim() || !courseContext.trim()) {
      return alert('All fields are required to submit a solution.');
    }

    try {
      const { error } = await supabase.from('problem_solutions').insert({
        problem_id: problemId,
        user_id: user.id,
        student_name: user.user_metadata?.full_name || 'Solver Agent',
        contact_email: user.email,
        course_context: courseContext,
        solution_title: solutionTitle,
        solution_description: solutionDesc
      });

      if (error) throw error;
      alert('Your solution idea has been submitted successfully!');
      setSolutionTitle(''); setSolutionDesc(''); setCourseContext('');
      fetchProblemsAndSolutions();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCommitSelectionScore(solutionId) {
    try {
      const { error } = await supabase
        .from('problem_solutions')
        .update({
          impact_score: parseInt(impactScore),
          feasibility_score: parseInt(feasibilityScore),
          status: 'selected'
        })
        .eq('id', solutionId);

      if (error) throw error;
      alert('Solution selected! This has automatically moved into Gate 1 of the Idea Pipeline.');
      setSelectedSolutionId(null);
      fetchProblemsAndSolutions();
    } catch (err) {
      alert(err.message);
    }
  }

  const activeProblem = problems.find(p => p.id === activeProblemId);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 bg-[#F9FAFB] min-h-screen text-gray-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold tracking-tight">Problem Statement Hub</h1>
          <span className="text-gray-400 text-xs ml-2">(i)</span>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2 text-white font-semibold text-xs rounded-xl shadow-md active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(90deg, #D7263D, #1D4ED8)' }}
        >
          <PlusCircle className="w-4 h-4" /> {isFormOpen ? 'Close Composer' : 'Post a Challenge'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handlePostProblem} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-in slide-in-from-top-4 duration-200">
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Problem Title *</label>
              <input 
                type="text" 
                placeholder='e.g., Cold storage access for small farmers in Telangana'
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full p-2.5 bg-gray-50 border rounded-lg focus:outline-none" 
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Description & Context Details *</label>
              <textarea 
                placeholder="Explain the background scenario, exact real-world pain points, and target stakeholders involved..."
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full p-2.5 bg-gray-50 border rounded-lg focus:outline-none" 
                rows={4} 
              />
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Domain Classification Tags</label>
              <input 
                type="text" 
                placeholder="Type a tag name (e.g. AgriTech) and press Enter" 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    if (!domainTags.includes(tagInput.trim())) {
                      setDomainTags([...domainTags, tagInput.trim()]);
                    }
                    setTagInput('');
                  }
                }}
                className="w-full p-2 bg-gray-50 border rounded-lg focus:outline-none" 
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {domainTags.map(t => (
                  <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-semibold">
                    #{t} <button type="button" onClick={() => setDomainTags(domainTags.filter(x => x !== t))} className="text-red-500 font-bold">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-gray-700 mb-0.5">Your Stakeholder Role *</label>
                <select 
                  value={postedByRole} 
                  onChange={(e) => setPostedByRole(e.target.value)} 
                  className="w-full p-2 bg-gray-50 border rounded-lg focus:outline-none font-medium"
                >
                  <option value="faculty">Faculty Member</option>
                  <option value="industry partner">Industry Partner</option>
                  <option value="community member">Community Member</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-0.5">Optional Resolution Deadline</label>
                <input 
                  type="date" 
                  value={deadline} 
                  onChange={(e) => setDeadline(e.target.value)} 
                  className="w-full p-2 bg-gray-50 border rounded-lg focus:outline-none" 
                />
              </div>
            </div>

            <button type="submit" className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl uppercase tracking-wider mt-2">
              Launch Problem Into Active Listing Feed
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-96 bg-white animate-pulse rounded-2xl border border-gray-200" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Challenge Left Sidebar Selector Strip */}
          <div className="space-y-3 lg:col-span-1">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase px-1">Open Challenges Ecosystem</p>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {problems.map(p => (
                <div
                  key={p.id}
                  onClick={() => setActiveProblemId(p.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    activeProblemId === p.id ? 'border-blue-600 bg-blue-50/60 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap gap-1 mb-1">
                    {p.domain_tags?.map(t => (
                      <span key={t} className="bg-gray-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded">#{t}</span>
                    ))}
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm leading-tight truncate">{p.title}</h4>
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2 font-medium">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {p.posted_by_name}</span>
                    <span>{p.problem_solutions?.length || 0} Submissions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Workspace Interactive Right Layout */}
          <div className="lg:col-span-2 space-y-4">
            {activeProblem ? (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{activeProblem.title}</h2>
                    <div className="flex flex-wrap gap-4 items-center text-xs text-gray-400 mt-2 font-medium">
                      <span className="bg-gray-900 text-white font-bold text-[10px] px-2 py-0.5 rounded capitalize">{activeProblem.posted_by_role}</span>
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Posted by: {activeProblem.posted_by_name}</span>
                      {activeProblem.deadline && (
                        <span className="flex items-center gap-1 text-amber-600"><Calendar className="w-3.5 h-3.5" /> Deadline: {new Date(activeProblem.deadline).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap">{activeProblem.description}</p>
                </div>

                {/* Submitted Solutions Loop Array Render Block */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Proposed Student Solutions ({activeProblem.problem_solutions?.length || 0})</h3>
                  {activeProblem.problem_solutions?.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No team ideas submitted yet for this statement context bottleneck.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeProblem.problem_solutions.map(sol => (
                        <div key={sol.id} className={`p-4 border rounded-xl space-y-2 relative ${sol.status === 'selected' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
                          {sol.status === 'selected' && (
                            <span className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Award className="w-3 h-3" /> CHOSEN FOR INCUBATION life cycle
                            </span>
                          )}
                          <div className="text-xs">
                            <h4 className="font-bold text-gray-900 text-sm">{sol.solution_title}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Author: {sol.student_name} ({sol.course_context})</p>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{sol.solution_description}</p>
                          
                          {isManagement && sol.status === 'pending' && (
                            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                              {selectedSolutionId === sol.id ? (
                                <div className="flex items-center gap-3 bg-white p-2 border rounded-xl shadow-sm animate-in zoom-in-95">
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <span className="font-bold">Impact:</span>
                                    <input type="number" min="1" max="10" value={impactScore} onChange={(e) => setImpactScore(e.target.value)} className="w-10 p-0.5 border text-center rounded bg-gray-50" />
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <span className="font-bold">Feasibility:</span>
                                    <input type="number" min="1" max="10" value={feasibilityScore} onChange={(e) => setFeasibilityScore(e.target.value)} className="w-10 p-0.5 border text-center rounded bg-gray-50" />
                                  </div>
                                  <button onClick={() => handleCommitSelectionScore(sol.id)} className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-1 rounded">Approve Selection</button>
                                </div>
                              ) : (
                                <button onClick={() => setSelectedSolutionId(sol.id)} className="bg-gray-900 text-white font-bold text-[10px] px-3 py-1 rounded-lg ml-auto">Grade & Fast-Track to Pipeline</button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Solver Form Panel for regular students */}
                {!isManagement && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Propose a Solution Strategy</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">Your Solution/Startup Title Name *</label>
                          <input type="text" placeholder="e.g. EcoBox Processing Unit" value={solutionTitle} onChange={(e) => setSolutionTitle(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">Your Academic Course / Department context *</label>
                          <input type="text" placeholder="e.g. B.Tech Agri Sciences, Year 3" value={courseContext} onChange={(e) => setCourseContext(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:outline-none" />
                        </div>
                      </div>
                      <div className="space-y-3 flex flex-col justify-between">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">How do you propose to resolve this challenge? *</label>
                          <textarea placeholder="Detail your step-by-step technological approach blueprint..." value={solutionDesc} onChange={(e) => setSolutionDesc(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:outline-none" rows={3} />
                        </div>
                        <button onClick={() => handlePostSolution(activeProblem.id)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl tracking-wide uppercase transition-colors">
                          Commit Solution Framework
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
                <p className="text-gray-400 text-sm font-medium">Select an open challenge parameters from the sidebar stream view configuration layout context.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}