import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

const Resumes = () => {
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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <Toaster />
      {error && <p className="text-red-500 text-center mb-4 font-inter transition-opacity duration-500">{error}</p>}
      {successMessage && <p className="text-green-500 text-center mb-4 font-inter transition-opacity duration-500">{successMessage}</p>}
      <h2 className="text-2xl font-poppins font-bold mb-6">Saved Resumes</h2>
      {resumes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resumes.map((resume) => (
            <div key={resume.id} className="bg-gray-50 p-6 rounded-lg shadow-lg flex flex-col justify-between">
              <h3 className="text-lg text-gray-800 font-semibold mb-4">{resume.title || 'Untitled Resume'}</h3>
              <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-auto">
                <button
                  onClick={() => handleDownload(resume.latex, resume.title, 'tex')}
                  className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition duration-200 text-sm font-poppins"
                >
                  Download .tex
                </button>
                <button
                  onClick={() => handleDeleteResume(resume.id)}
                  className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-200 text-sm font-poppins"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-inter">You have no saved resumes.</p>
      )}
    </div>
  );
};

export default Resumes;
