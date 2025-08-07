import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const AppMain = () => {
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
  const [resumeTitle, setResumeTitle] = useState('');

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
      const resumesRef = collection(db, 'users', user.uid, 'resumes');
      await addDoc(resumesRef, {
        title: resumeTitle,
        latex: latexInput,
        jobDescription: jobDescription,
        createdAt: new Date(),
      });
      setSuccessMessage('Resume saved successfully!');
      setShowSaveModal(false);
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
        
        <div className="mt-6 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleProcessResume}
            disabled={processing || !latexInput || !jobDescription}
            className="flex-1 bg-crimson-light text-white py-3 rounded-lg hover:bg-crimson-dark transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-poppins font-semibold"
          >
            {processing ? 'Processing...' : 'Process Resume (AI)'}
          </button>
          <button
            onClick={() => handleDownload('tex')}
            disabled={!processed}
            className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-poppins font-semibold"
          >
            Download .tex
          </button>
        </div>
        
        {processing && (
          <div className="w-full bg-crimson-light rounded-full h-2.5 mt-4 overflow-hidden">
            <div className="h-full bg-crimson-dark animate-pulse-indeterminate"></div>
          </div>
        )}
        {error && <p className="text-red-500 text-center mt-4 transition-opacity duration-500">{error}</p>}
        {successMessage && <p className="text-green-500 text-center mt-4 transition-opacity duration-500">{successMessage}</p>}

        {processed && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-lg font-poppins font-semibold text-gray-800 mb-3">AI Processing Results</h3>
            
            {matchScore !== null && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-md font-medium text-gray-700">Match Score:</span>
                  <span className="text-lg font-bold text-crimson-dark">{matchScore}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-crimson-light h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${matchScore}%` }}
                  ></div>
                </div>
                {matchScoreExplanation && (
                  <p className="text-sm text-gray-600 mt-2">{matchScoreExplanation}</p>
                )}
              </div>
            )}

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
          </div>
        )}

        {showSaveModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm mx-auto">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Save Resume</h3>
              <div className="mt-2">
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-crimson-light focus:outline-none"
                  placeholder="Enter resume title"
                  value={resumeTitle}
                  onChange={(e) => setResumeTitle(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setResumeTitle('');
                  }}
                  className="bg-gray-300 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveResume}
                  className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppMain;