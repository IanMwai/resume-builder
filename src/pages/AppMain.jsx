import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

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
      // Increment progress to simulate activity, stalling at 90% until complete
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90;
          // random increment between 1 and 3
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

  // FIXED PARSING FUNCTION - CONSISTENT WITH BACKEND FORMAT
  function parseAIOutput(text) {
    console.log("Parsing AI response...");
    
    const result = {};
    
    // Extract rewritten resume
    const resumeMatch = text.match(/<rewritten_resume>([\s\S]*?)<\/rewritten_resume>/i);
    result.rewritten_resume = resumeMatch ? resumeMatch[1].trim() : "";
    
    // Extract analysis
    const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/i);
    if (!analysisMatch) {
      throw new Error("Missing <analysis> section in AI response");
    }
    
    const analysisText = analysisMatch[1];
    
    // Extract match score
    const scoreMatch = analysisText.match(/<match_score>(\d+)<\/match_score>/i);
    const matchScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    
    // Extract match explanation
    const explanationMatch = analysisText.match(/<match_score_explanation>([\s\S]*?)<\/match_score_explanation>/i);
    const matchScoreExplanation = explanationMatch ? explanationMatch[1].trim() : "";
    
    // Extract enhanced parts
    const enhancedMatch = analysisText.match(/<enhanced_parts>([\s\S]*?)<\/enhanced_parts>/i);
    let enhancedParts = [];
    if (enhancedMatch) {
      enhancedParts = enhancedMatch[1].split('---').map(part => {
        const trimmed = part.trim();
        if (!trimmed) return null;
        
        // More robust parsing
        const itemMatch = trimmed.match(/item:\s*([^\n]+)/i);
        const descMatch = trimmed.match(/description:\s*([^\n]+)/i);
        const reasonMatch = trimmed.match(/reason:\s*([^\n]+)/i);
        
        const item = itemMatch ? itemMatch[1].trim() : '';
        const description = descMatch ? descMatch[1].trim() : '';
        const reason = reasonMatch ? reasonMatch[1].trim() : '';
        
        // Only return if we have all three fields
        if (item && description && reason) {
          return { item, description, reason };
        }
        return null;
      }).filter(Boolean);
    }
    
    // Extract removed parts
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
        
        // Only return if we have all three fields
        if (item && description && reason) {
          return { item, description, reason };
        }
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latexInput, jobDescription }),
        }
      );

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch {
          errorText = `HTTP ${response.status}`;
        }
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();
      
      if (!responseText || responseText.length < 100) {
        throw new Error("Received empty response from AI service");
      }

      let parsedResponse;
      try {
        parsedResponse = parseAIOutput(responseText);
      } catch (parseError) {
        console.error("Error parsing AI output:", parseError);
        console.error("Raw AI response:", responseText);
        throw new Error("AI generated incomplete response. Please try again.");
      }

      if (!parsedResponse.rewritten_resume) {
        throw new Error("AI did not return enhanced resume content");
      }

      setLatexInput(parsedResponse.rewritten_resume);
      setSummary(parsedResponse.analysis.summary_of_changes || null);
      setMatchScore(parsedResponse.analysis.match_score || null);
      setMatchScoreExplanation(parsedResponse.analysis.match_score_explanation || '');
      setProcessed(true);
      setSuccessMessage('Resume processed successfully!');

    } catch (error) {
      console.error('Error processing resume:', error);
      
      if (error.message.includes("quota exceeded")) {
        setError('AI service quota exceeded. Please try again in a few minutes.');
      } else if (error.message.includes("rate limit")) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (error.message.includes("incomplete response")) {
        setError('AI generated incomplete response. Please try again.');
      } else {
        setError('Error processing resume with AI. Please try again. Ensure your input is valid LaTeX and you have added a job description.');
      }
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
      setSuccessMessage('Resume downloaded successfully! Use a LaTeX compiler like Overleaf to generate a PDF from your .tex file.');
    }
  };

  const handleSaveResume = async () => {
    if (!user) {
      setError('You must be logged in to save a resume.');
      return;
    }

    if (!resumeTitle.trim()) {
      setError('Resume title cannot be empty.');
      return;
    }

    try {
      // Check for duplicates
      const resumesRef = collection(db, 'users', user.uid, 'resumes');
      const q = query(resumesRef, where('title', '==', resumeTitle.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError('A resume with this title already exists. Please choose a different name.');
        return;
      }

      await addDoc(resumesRef, {
        title: resumeTitle.trim(),
        latex: latexInput,
        jobDescription: jobDescription,
        createdAt: new Date(),
      });
      // setSuccessMessage('Resume saved successfully!'); // Removed to use modal instead
      setShowSaveModal(false);
      setShowPostSaveModal(true); // Show post-save options
      setResumeTitle('');
    } catch (error) {
      console.error('Error saving resume:', error);
      setError('Failed to save resume. Please try again.');
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-xl p-6">
        <Toaster />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-poppins font-semibold leading-6 text-gray-900">Resume (.tex)</h3>
              <button
                onClick={() => setLatexInput('')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="mt-2">
              <textarea
                rows="12"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-md focus:ring-2 focus:ring-crimson-light focus:outline-none resize-y overflow-auto font-inter"
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                placeholder="Paste your LaTeX code here or upload a .tex file."
              ></textarea>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-inter font-medium text-gray-700 mb-1">
                Upload .tex file
              </label>
              <input
                type="file"
                accept=".tex"
                onChange={handleFileUpload}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-crimson-light file:text-white hover:file:bg-crimson-dark transition duration-200"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-poppins font-semibold leading-6 text-gray-900">Job Description</h3>
              <button
                onClick={() => setJobDescription('')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="mt-2">
              <textarea
                rows="12"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-md focus:ring-2 focus:ring-crimson-light focus:outline-none resize-y overflow-auto font-inter"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here."
              ></textarea>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <button
            onClick={handleProcessResume}
            disabled={processing || !latexInput || !jobDescription}
            className={`w-full sm:w-auto px-8 py-4 rounded-xl text-lg font-poppins font-bold tracking-wide shadow-lg transform transition-all duration-300 ${
              processing || !latexInput || !jobDescription
                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                : 'bg-gradient-to-r from-crimson-light to-crimson-dark text-white hover:scale-105 hover:shadow-crimson-light/50'
            }`}
          >
            {processing ? (
               <span className="flex items-center justify-center">
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Processing...
               </span>
            ) : '✨ Enhance Resume with AI'}
          </button>
          <button
            onClick={() => handleDownload('tex')}
            disabled={!processed}
            className={`w-full sm:w-auto px-8 py-4 rounded-xl text-lg font-poppins font-semibold shadow-md transition-all duration-300 ${
               !processed 
               ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
               : 'bg-white text-gray-800 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            Download .tex
          </button>
        </div>
        
        {processing && (
          <div className="mt-8">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-crimson-dark">AI Analysis in Progress</span>
              <span className="text-sm font-medium text-crimson-dark">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-crimson-light h-3 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2 animate-pulse">
              {progress < 30 ? "Reading resume and job description..." : 
               progress < 60 ? "Analyzing key skills and requirements..." : 
               progress < 90 ? "Optimizing content and formatting..." : "Finalizing changes..."}
            </p>
          </div>
        )}

        {error && <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg shadow-sm">{error}</div>}
        {successMessage && <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-r-lg shadow-sm">{successMessage}</div>}

        {processed && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-lg font-poppins font-semibold text-gray-800 mb-3">AI Processing Results</h3>
            
            {matchScore !== null && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-md font-medium text-gray-700">Match Score:</span>
                  <span className={`text-lg font-bold ${matchScore < 50 ? 'text-red-600' : 'text-crimson-dark'}`}>
                    {matchScore}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                      matchScore < 50 ? 'bg-red-500' : 'bg-crimson-light'
                    }`}
                    style={{ width: `${matchScore}%` }}
                  ></div>
                </div>
                {matchScoreExplanation && (
                  <p className="text-sm text-gray-600 mt-2">{matchScoreExplanation}</p>
                )}
              </div>
            )}

            {/* Show warning for low match scores */}
            {matchScore !== null && matchScore < 50 ? (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Low Match Score - Resume Enhancement Needed
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Your resume has a low match score ({matchScore}%) for this position. This typically means:
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Your skills and experience don't align well with the job requirements</li>
                        <li>The resume may be for a different field or role type</li>
                        <li>Key qualifications mentioned in the job posting are missing</li>
                      </ul>
                      <p className="mt-3 font-medium">
                        <strong>Recommendation:</strong> Review the job requirements and update your resume with more relevant experience, skills, or education before processing again.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Show normal results for match scores 50% and above
              <>
                {summary && (
                  <details className="group bg-white p-3 rounded-lg shadow cursor-pointer">
                    <summary className="flex justify-between items-center font-medium text-gray-700">
                      <span>Summary of Changes</span>
                      <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
                    </summary>
                    <div className="mt-3 text-gray-600 text-sm font-inter">
                      {summary.enhanced_parts && summary.enhanced_parts.length > 0 && (
                        <div className="mb-4">
                          <p className="font-semibold text-green-700 mb-2">Enhanced Parts:</p>
                          <div className="space-y-2">
                            {summary.enhanced_parts.map((change, index) => (
                              <div key={index} className="bg-green-50 p-3 rounded-md border-l-4 border-green-400">
                                <div className="font-semibold text-green-800">{change.item}</div>
                                <div className="text-gray-700 mt-1">{change.description}</div>
                                <div className="text-sm text-green-600 italic mt-1">
                                  Why: {change.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {summary.removed_parts && summary.removed_parts.length > 0 && (
                        <div className="mb-2">
                          <p className="font-semibold text-red-700 mb-2">Removed Parts:</p>
                          <div className="space-y-2">
                            {summary.removed_parts.map((change, index) => (
                              <div key={index} className="bg-red-50 p-3 rounded-md border-l-4 border-red-400">
                                <div className="font-semibold text-red-800">{change.item}</div>
                                <div className="text-gray-700 mt-1">{change.description}</div>
                                <div className="text-sm text-red-600 italic mt-1">
                                  Why: {change.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(!summary.enhanced_parts?.length && !summary.removed_parts?.length) && (
                        <p className="text-gray-600 italic">Primarily rephrasing and minor improvements.</p>
                      )}
                    </div>
                  </details>
                )}

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200 font-poppins font-semibold"
                  >
                    Save Resume
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {showSaveModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowSaveModal(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Save Resume</h3>
                      <div className="mt-2">
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-crimson-light focus:outline-none"
                          placeholder="Enter resume title"
                          value={resumeTitle}
                          onChange={(e) => setResumeTitle(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSaveResume}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveModal(false);
                      setResumeTitle('');
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPostSaveModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Resume Saved!</h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Your resume has been successfully saved to your profile. What would you like to do next?
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPostSaveModal(false);
                      navigate('/resumes');
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-crimson-light text-base font-medium text-white hover:bg-crimson-dark focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    View All Resumes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPostSaveModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Stay Here
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppMain;