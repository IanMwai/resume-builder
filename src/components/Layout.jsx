import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const Layout = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-neutral-text-primary">
      <Navbar />
      {user && userData && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 mt-4 bg-rose-50 rounded-lg shadow-md">
          <h2 className="text-lg font-poppins text-gray-800 text-center">
            {`${(userData.preferredName || userData.firstName).charAt(0).toUpperCase() + (userData.preferredName || userData.firstName).slice(1)}! Haven’t landed the job yet? Let’s fix that; your resume glow-up starts now!`}
          </h2>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;