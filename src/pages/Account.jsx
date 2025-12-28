import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const Account = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setFirstName(data.firstName);
            setLastName(data.lastName);
            setPreferredName(data.preferredName);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load account information. Please try again.');
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        firstName,
        lastName,
        preferredName,
      });
      setMessage('Account updated successfully.');
    } catch (error) {
      console.error('Error updating account:', error);
      setError('Failed to update account. Please try again.');
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl mx-auto">
      <div className="border-b border-gray-100 pb-4 mb-8">
        <h2 className="text-3xl font-poppins font-bold text-gray-900">Account Settings</h2>
        <p className="text-gray-500 mt-1">Update your personal information</p>
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-md">{error}</div>}
      {message && <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-r-md">{message}</div>}
      
      {userData ? (
        <form onSubmit={handleUpdateAccount} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-crimson-light focus:border-crimson-light transition-colors"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-crimson-light focus:border-crimson-light transition-colors"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-crimson-light focus:border-crimson-light transition-colors"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-crimson-light text-white py-3 px-6 rounded-lg hover:bg-crimson-dark transition duration-200 font-poppins font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crimson-light"></div>
        </div>
      )}
    </div>
  );
};

export default Account;