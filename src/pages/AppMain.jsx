import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

// --- Reusable UI Components ---

const IconButton = ({ icon, label, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 ${className}`}
    title={label}
    aria-label={label}
  >
    {icon}
  </button>
);

const PrimaryButton = ({ children, onClick, disabled, loading, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`
      h-12 px-8 rounded-xl font-semibold text-white shadow-lg shadow-crimson-light/20
      transition-all duration-200 transform active:scale-[0.98]
      ${disabled || loading 
        ? 'bg-slate-300 cursor-not-allowed shadow-none' 
        : 'bg-crimson-light hover:bg-crimson-dark hover:-translate-y-0.5'}
      ${className}
    `}
  >
    <div className="flex items-center justify-center gap-2">
      {loading && (
        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </div>
  </button>
);

const SecondaryButton = ({ children, onClick, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      h-12 px-6 rounded-xl font-semibold border-2 border-slate-200 text-slate-600
      hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'bg-white'}
      ${className}
    `}
  >
    {children}
  </button>
);

const EditorCard = ({ title, badge, value, onChange, onUpload, onClear, onCopy, placeholder, isMono = false }) => {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-slate-800 tracking-tight">{title}</h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
            {badge}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onUpload && (
            <div className="relative">
              <IconButton 
                label="Upload .tex file" 
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
                onClick={() => document.getElementById(`upload-${badge}`).click()}
              />
              <input id={`upload-${badge}`} type="file" accept=".tex" className="hidden" onChange={onUpload} />
            </div>
          )}
          <IconButton 
            label="Copy to clipboard" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>}
            onClick={() => onCopy(value)}
          />
          <IconButton 
            label="Clear" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>}
            onClick={onClear}
            className="hover:text-red-500 hover:bg-red-50"
          />
        </div>
      </div>
      <div className="relative flex-grow">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full h-[480px] p-6 resize-none outline-none
            bg-slate-50/50 text-slate-700 leading-relaxed
            placeholder:text-slate-400/80 transition-colors
            focus:bg-white
            ${isMono ? 'font-mono text-[13px]' : 'font-inter text-[14px]'}
          `}
          spellCheck="false"
        />
        <div className="absolute bottom-4 right-6 flex items-center gap-4 text-[11px] font-medium text-slate-400 select-none">
          <span>{wordCount} words</span>
          <span>{value.length} chars</span>
        </div>
      </div>
    </div>
  );
};

const AppMain = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [latexInput, setLatexInput] = useState(() => localStorage.getItem('latexInput') || '');
  const [summary, setSummary] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('summary')) || null;
    } catch (e) {
      console.error("Error parsing summary from sessionStorage", e);
      return null;
    }
  });
  const [matchScore, setMatchScore] = useState(() => sessionStorage.getItem('matchScore') || null);
  const [matchScoreExplanation, setMatchScoreExplanation] = useState(() => sessionStorage.getItem('matchScoreExplanation') || '');
  const [jobDescription, setJobDescription] = useState(() => localStorage.getItem('jobDescription') || '');
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(() => sessionStorage.getItem('processed') === 'true');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPostSaveModal, setShowPostSaveModal] = useState(false);
  const [resumeTitle, setResumeTitle] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('latexInput', latexInput);
  }, [latexInput]);

  useEffect(() => {
    localStorage.setItem('jobDescription', jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    sessionStorage.setItem('summary', JSON.stringify(summary));
  }, [summary]);

  useEffect(() => {
    sessionStorage.setItem('matchScore', matchScore);
  }, [matchScore]);

  useEffect(() => {
    sessionStorage.setItem('matchScoreExplanation', matchScoreExplanation);
  }, [matchScoreExplanation]);

  useEffect(() => {
    sessionStorage.setItem('processed', processed);
  }, [processed]);

  useEffect(() => {
    if (processed) {
      toast.success('AI Analysis Ready!', {
        duration: 3000,
        position: 'top-right',
      });
    }
  }, [processed]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    let interval;
    if (processing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 2 + 1;
        });
      }, 500);
    } else if (processed) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [processing, processed]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setLatexInput(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  function parseAIOutput(text) {
    const result = {};
    const resumeMatch = text.match(/<rewritten_resume>([\s\S]*?)<\/rewritten_resume>/i);
    result.rewritten_resume = resumeMatch ? resumeMatch[1].trim() : "";
    
    const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/i);
    if (!analysisMatch) throw new Error("Missing <analysis> section in AI response");
    
    const analysisText = analysisMatch[1];
    const scoreMatch = analysisText.match(/<match_score>(\d+)<\/match_score>/i);
    const matchScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    
    const explanationMatch = analysisText.match(/<match_score_explanation>([\s\S]*?)<\/match_score_explanation>/i);
    const matchScoreExplanation = explanationMatch ? explanationMatch[1].trim() : "";
    
    const enhancedMatch = analysisText.match(/<enhanced_parts>([\s\S]*?)<\/enhanced_parts>/i);
    let enhancedParts = [];
    if (enhancedMatch) {
      enhancedParts = enhancedMatch[1].split('---').map(part => {
        const trimmed = part.trim();
        if (!trimmed) return null;
        const itemMatch = trimmed.match(/item:\s*([^\n]+)/i);
        const descMatch = trimmed.match(/description:\s*([^\n]+)/i);
        const reasonMatch = trimmed.match(/reason:\s*([^\n]+)/i);
        const item = itemMatch ? itemMatch[1].trim() : '';
        const description = descMatch ? descMatch[1].trim() : '';
        const reason = reasonMatch ? reasonMatch[1].trim() : '';
        if (item && description && reason) return { item, description, reason };
        return null;
      }).filter(Boolean);
    }
    
    const removedMatch = analysisText.match(/<removed_parts>([\s\S]*?)<\/removed_parts>/i);
    let removedParts = [];
    if (removedMatch) {
      removedParts = removedMatch[1].split('---').map(part => {
        const trimmed = part.trim();
        if (!trimmed) return null;
        const itemMatch = trimmed.match(/item:\s*([^\n]+)/i);
        const descMatch = trimmed.match(/description:\s*([^\n]+)/i);
        const reasonMatch = trimmed.match(/reason:\s*([^\n]+)/i);
        const item = itemMatch ? itemMatch[1].trim() : '';
        const description = descMatch ? descMatch[1].trim() : '';
        const reason = reasonMatch ? reasonMatch[1].trim() : '';
        if (item && description && reason) return { item, description, reason };
        return null;
      }).filter(Boolean);
    }
    
    return {
      rewritten_resume: result.rewritten_resume,
      analysis: {
        match_score: matchScore,
        match_score_explanation: matchScoreExplanation,
        summary_of_changes: {
          enhanced_parts: enhancedParts,
          removed_parts: removedParts
        }
      }
    };
  }

  const handleProcessResume = async () => {
    setProcessing(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        "https://us-central1-resume-builder-ian.cloudfunctions.net/processResumeWithGemini",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latexInput, jobDescription }),
        }
      );

      if (!response.ok) {
        let errorText;
        try { errorText = await response.text(); } catch { errorText = `HTTP ${response.status}`; }
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();
      if (!responseText || responseText.length < 100) throw new Error("Received empty response from AI service");

      let parsedResponse;
      try {
        parsedResponse = parseAIOutput(responseText);
      } catch (parseError) {
        throw new Error("AI generated incomplete response. Please try again.");
      }

      if (!parsedResponse.rewritten_resume) throw new Error("AI did not return enhanced resume content");

      setLatexInput(parsedResponse.rewritten_resume);
      setSummary(parsedResponse.analysis.summary_of_changes || null);
      setMatchScore(parsedResponse.analysis.match_score || null);
      setMatchScoreExplanation(parsedResponse.analysis.match_score_explanation || '');
      setProcessed(true);
      setSuccessMessage('Resume processed successfully!');

    } catch (error) {
      console.error('Error processing resume:', error);
      setError(error.message.includes("quota") ? 'AI service quota exceeded. Please try again later.' : 'Error processing resume with AI. Please try again.');
    }
    setProcessing(false);
  };

  const handleDownload = (type) => {
    if (type === 'tex') {
      const blob = new Blob([latexInput], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume.tex';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMessage('Resume downloaded successfully!');
    }
  };

  const handleSaveResume = async () => {
    if (!user) { setError('You must be logged in to save a resume.'); return; }
    if (!resumeTitle.trim()) { setError('Resume title cannot be empty.'); return; }
    
    try {
      const resumesRef = collection(db, 'users', user.uid, 'resumes');
      const q = query(resumesRef, where('title', '==', resumeTitle.trim()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { setError('A resume with this title already exists.'); return; }

      await addDoc(resumesRef, {
        title: resumeTitle.trim(),
        latex: latexInput,
        jobDescription: jobDescription,
        createdAt: new Date(),
      });
      setShowSaveModal(false);
      setShowPostSaveModal(true);
      setResumeTitle('');
    } catch (error) {
      setError('Failed to save resume. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-20">
      <Toaster />
      
      {/* Page Header */}
      <div className="mb-10">
        <h2 className="text-3xl font-poppins font-bold text-slate-900 tracking-tight">
          Enhance Your Resume
        </h2>
        <p className="mt-2 text-slate-500 font-inter text-lg">
          Provide your LaTeX source and the target job description to optimize for keywords and impact.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Resume Input */}
        <EditorCard
          title="Resume Source"
          badge="LaTeX"
          value={latexInput}
          onChange={setLatexInput}
          onUpload={handleFileUpload}
          onClear={() => setLatexInput('')}
          onCopy={handleCopy}
          placeholder="% Paste your LaTeX code here..."
          isMono={true}
        />

        {/* Job Description Input */}
        <EditorCard
          title="Target Job"
          badge="JD"
          value={jobDescription}
          onChange={setJobDescription}
          onClear={() => setJobDescription('')}
          onCopy={handleCopy}
          placeholder="Paste the job requirements and responsibilities here..."
        />
      </div>
      
      {/* Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm sticky bottom-8 z-10">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <PrimaryButton
            onClick={handleProcessResume}
            loading={processing}
            disabled={!latexInput || !jobDescription}
            className="w-full md:w-auto min-w-[240px]"
          >
            Enhance Resume with AI
          </PrimaryButton>
          <p className="text-[11px] text-slate-400 px-1 text-center md:text-left">
            Analysis and rewriting usually takes 15-25 seconds.
          </p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <SecondaryButton
            onClick={() => handleDownload('tex')}
            disabled={!processed}
            className="w-full md:w-auto flex items-center gap-2 justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12"/></svg>
            Download .tex
          </SecondaryButton>
        </div>
      </div>

      {/* Progress Section */}
      {processing && (
        <div className="mt-12 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
          <div className="flex justify-between mb-3">
            <span className="text-sm font-semibold text-crimson-light">AI Analysis in Progress</span>
            <span className="text-sm font-bold text-slate-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-crimson-light h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(220,20,60,0.3)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4 animate-pulse">
            {progress < 30 ? "Contextualizing your experience..." : 
             progress < 60 ? "Matching skills to job requirements..." : 
             progress < 90 ? "Optimizing LaTeX formatting..." : "Finalizing results..."}
          </p>
        </div>
      )}

      {error && <div className="mt-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3">
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
        {error}
      </div>}
      
      {successMessage && <div className="mt-8 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-sm font-medium flex items-center gap-3">
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
        {successMessage}
      </div>}

      {/* Results Section */}
      {processed && (
        <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-poppins font-bold text-slate-900">AI Processing Results</h3>
              {matchScore !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Score</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${matchScore < 50 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {matchScore}%
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-6">
              {matchScore !== null && (
                <div className="mb-8">
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${matchScore < 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${matchScore}%` }}
                    ></div>
                  </div>
                  {matchScoreExplanation && (
                    <p className="text-slate-600 text-[15px] leading-relaxed italic border-l-4 border-slate-200 pl-4">{matchScoreExplanation}</p>
                  )}
                </div>
              )}

              {matchScore !== null && matchScore < 50 ? (
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 flex gap-4">
                  <div className="flex-shrink-0 text-amber-500">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm mb-1">Low Match Score Detected</h4>
                    <p className="text-amber-800 text-sm leading-relaxed">
                      Your resume has a lower alignment for this specific role. We've attempted enhancements, but you might need more relevant experience or specific skills mentioned in the JD.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {summary && (
                    <div className="space-y-6">
                      {summary.enhanced_parts?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">Key Enhancements</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {summary.enhanced_parts.map((change, index) => (
                              <div key={index} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                                <div className="font-bold text-emerald-900 text-[14px] mb-1">{change.item}</div>
                                <p className="text-slate-600 text-xs mb-2">{change.description}</p>
                                <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/50 px-2 py-1 rounded inline-block">
                                  WHY: {change.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {summary.removed_parts?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-4">Strategic Removals</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {summary.removed_parts.map((change, index) => (
                              <div key={index} className="bg-red-50/50 p-4 rounded-xl border border-red-100/50">
                                <div className="font-bold text-red-900 text-[14px] mb-1">{change.item}</div>
                                <p className="text-slate-600 text-xs mb-2">{change.description}</p>
                                <div className="text-[10px] text-red-700 font-semibold bg-red-100/50 px-2 py-1 rounded inline-block">
                                  WHY: {change.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-10 flex justify-center border-t border-slate-100 pt-8">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="bg-emerald-500 text-white h-12 px-10 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      Save Enhanced Version
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-poppins font-bold text-slate-900">Save Optimized Resume</h3>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resume Title</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crimson-light/20 focus:border-crimson-light focus:outline-none transition-all placeholder:text-slate-400"
                placeholder="e.g., Software Engineer - Google Application"
                value={resumeTitle}
                onChange={(e) => { setResumeTitle(e.target.value); setError(''); }}
              />
              {error && <p className="text-red-500 text-[11px] mt-2 font-medium">{error}</p>}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              <button 
                onClick={() => { setShowSaveModal(false); setResumeTitle(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResume}
                className="bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showPostSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h3 className="text-xl font-poppins font-bold text-slate-900 mb-2">Resume Saved!</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Your optimized resume is now securely stored in your dashboard.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowPostSaveModal(false); navigate('/resumes'); }}
                className="w-full bg-crimson-light text-white h-11 rounded-xl font-bold hover:bg-crimson-dark transition-all"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => setShowPostSaveModal(false)}
                className="w-full h-11 rounded-xl font-semibold text-slate-500 hover:bg-slate-50 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppMain;
