import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      // Generic message for security reasons (prevents email enumeration)
      setMessage('If an account exists with this email, you will receive a password reset link shortly.');
    } catch (error) {
      if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        console.error('Password reset error:', error);
        if (error.code === 'auth/user-not-found') {
             setMessage('If an account exists with this email, you will receive a password reset link shortly.');
        } else {
             setError('An error occurred. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address to verify your account.
          </p>
        </div>
        
        {message && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-md">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">{message}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-crimson-light focus:border-crimson-light focus:z-10 sm:text-sm transition ease-in-out duration-150"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-crimson-light hover:bg-crimson-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crimson-light'
              } transition duration-150 ease-in-out`}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-4">
          <Link to="/login" className="font-medium text-crimson-light hover:text-crimson-dark transition ease-in-out duration-150">
            Back to Log In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;