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
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const messages = [
      "Ready to land your dream job?",
      "Let's make your resume shine today!",
      "Optimizing your career path, one line at a time.",
      "Time to stand out from the crowd.",
      "Your next opportunity is waiting.",
      "Let's tailor your resume for success.",
      "Building a better future, starting now."
    ];
    setGreeting(messages[Math.floor(Math.random() * messages.length)]);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-bg font-sans text-neutral-text-primary">
      <Navbar />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {user && userData && (
          <div className="py-8 mt-4 mb-6 border-b border-gray-200">
            <h1 className="text-3xl font-poppins font-bold text-gray-900 tracking-tight">
              Welcome back, {(userData.preferredName || userData.firstName).charAt(0).toUpperCase() + (userData.preferredName || userData.firstName).slice(1)}
            </h1>
            <p className="mt-2 text-lg text-gray-500 font-inter">
              {greeting}
              
            </p>
          </div>
        )}
        <main className="pb-12">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, { user, userData });
            }
            return child;
          })}
        </main>
      </div>
    </div>
  );
};

export default Layout;