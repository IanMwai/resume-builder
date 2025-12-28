import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setError('');
    setSuccessMessage('');
    try {
      await signOut(auth);
      setSuccessMessage('Logged out successfully!');
      navigate('/login');
    } catch (error) {
      setError('Error logging out. Please try again.');
      console.error('Error logging out:', error);
    }
  };

  const reauthenticateUser = async () => {
    const email = prompt("Please enter your email to reauthenticate:");
    const password = prompt("Please enter your password to reauthenticate:");

    if (!email || !password) {
      setError("Reauthentication cancelled or incomplete.");
      return false;
    }

    try {
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error) {
      setError("Reauthentication failed. Please check your email and password.");
      console.error("Reauthentication error:", error);
      return false;
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    setSuccessMessage('');
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        // Reauthenticate user before deleting
        const reauthenticated = await reauthenticateUser();
        if (!reauthenticated) {
          return;
        }

        // Delete user data from Firestore
        await deleteDoc(doc(db, 'users', user.uid));

        // Delete the user from Firebase Authentication
        await user.delete();
        setSuccessMessage('Account deleted successfully!');
        navigate('/login');
      } catch (error) {
        setError('Failed to delete account. Please try again.');
        console.error('Error deleting account:', error);
      }
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && <p className="text-red-500 text-center mb-2">{error}</p>}
        {successMessage && <p className="text-green-500 text-center mb-2">{successMessage}</p>}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/app" className="text-xl font-bold text-crimson-dark">
              Resume Builder
            </Link>
          </div>
          <div className="hidden md:block">
            {user && (
              <div className="ml-4 flex items-center md:ml-6">
                <Link
                  to="/app"
                  className="bg-crimson-light text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-crimson-dark transition duration-200 mr-4"
                >
                  Home
                </Link>
                <Link
                  to="/resumes"
                  className="bg-crimson-light text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-crimson-dark transition duration-200 mr-4"
                >
                  Saved Resumes
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="max-w-xs bg-white rounded-full flex items-center text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                  >
                    <span className="sr-only">Open user menu</span>
                    <svg
                      className="h-8 w-8 text-gray-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5">
                      <Link
                        to="/account"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Account Info
                      </Link>
                      <button
                        onClick={handleDeleteAccount}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Delete Account
                      </button>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
