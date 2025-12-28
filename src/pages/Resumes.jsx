import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

const Resumes = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000); // Clear error after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000); // Clear success message after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const resumesRef = collection(db, 'users', currentUser.uid, 'resumes');
          const querySnapshot = await getDocs(resumesRef);
          const savedResumes = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setResumes(savedResumes);
        } catch (error) {
          console.error('Error fetching resumes:', error);
          setError('Failed to load resumes. Please try again.');
        }
      } else {
        setUser(null);
        setResumes([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteResume = async (resumeId) => {
    setError('');
    setSuccessMessage('');
    if (window.confirm('Are you sure you want to delete this resume?')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'resumes', resumeId));
        setResumes(resumes.filter((resume) => resume.id !== resumeId));
        setSuccessMessage('Resume deleted successfully!');
      } catch (error) {
        console.error('Error deleting resume:', error);
        setError('Failed to delete resume. Please try again.');
      }
    }
  };

  const handleDownload = (latexContent, title, type) => {
    if (type === 'tex') {
      const blob = new Blob([latexContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'resume'}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMessage('Resume downloaded successfully! Use a LaTeX compiler like Overleaf to generate a PDF from your .tex file.');
    }
  };

  

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl min-h-[600px]">
      <Toaster />
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b pb-4 border-gray-100">
         <div>
             <h2 className="text-3xl font-poppins font-bold text-gray-900">Saved Resumes</h2>
             <p className="text-gray-500 mt-1">Manage and access your resume history</p>
         </div>
         <button 
           onClick={() => navigate('/app')}
           className="mt-4 md:mt-0 bg-crimson-light text-white px-5 py-2.5 rounded-lg hover:bg-crimson-dark transition shadow-md font-medium flex items-center"
         >
           <span className="mr-2 text-xl">+</span> Create New
         </button>
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-md">{error}</div>}
      {successMessage && <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-r-md">{successMessage}</div>}
      
      {resumes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {resumes.map((resume) => (
            <div key={resume.id} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
              <div className="p-6 flex-grow relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <svg className="w-24 h-24 text-crimson-light" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                </div>
                <h3 className="text-xl text-gray-800 font-bold mb-2 group-hover:text-crimson-dark transition-colors line-clamp-1">{resume.title || 'Untitled Resume'}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Created: {resume.createdAt?.toDate ? resume.createdAt.toDate().toLocaleDateString() : 'Unknown date'}
                </p>
                <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded border border-gray-100 line-clamp-3">
                  {resume.jobDescription ? resume.jobDescription.substring(0, 100) + '...' : 'No job description saved.'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => handleDownload(resume.latex, resume.title, 'tex')}
                  className="text-gray-600 hover:text-crimson-dark font-medium text-sm flex items-center transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download
                </button>
                <button
                  onClick={() => handleDeleteResume(resume.id)}
                  className="text-red-500 hover:text-red-700 font-medium text-sm flex items-center transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No resumes saved</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new resume enhancement.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/app')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-crimson-light hover:bg-crimson-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crimson-light"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create New Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Resumes;
