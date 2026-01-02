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
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <Navbar />
      <div className="w-full max-w-[1200px] mx-auto px-6">
        {user && userData && (
          <div className="py-10 mt-4 mb-2">
            <h1 className="text-4xl font-poppins font-bold text-slate-900 tracking-tight">
              Welcome back, {(userData.preferredName || userData.firstName).charAt(0).toUpperCase() + (userData.preferredName || userData.firstName).slice(1)}
            </h1>
            <p className="mt-3 text-lg text-slate-500 font-inter max-w-2xl leading-relaxed">
              {greeting}
            </p>
          </div>
        )}
        <main className="pb-20">
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