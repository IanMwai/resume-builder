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

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-neutral-text-primary">
      <Navbar />
      <div className="w-screen mx-auto px-4 md:px-8 lg:px-12">
        {user && userData && (
          <div className="py-4 mt-4 bg-rose-50 rounded-lg shadow-md">
            <h2 className="text-lg font-poppins text-gray-800 text-center">
              {`${(userData.preferredName || userData.firstName).charAt(0).toUpperCase() + (userData.preferredName || userData.firstName).slice(1)}! Haven’t landed the job yet? Let’s fix that; your resume glow-up starts now!`}
            </h2>
          </div>
        )}
        <main className="py-6">
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