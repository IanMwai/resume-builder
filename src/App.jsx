import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import AppMain from './pages/AppMain';
import Resumes from './pages/Resumes';
import Account from './pages/Account';
import Layout from './components/Layout';

const App = () => {
  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Main app routes could eventually share a layout or navbar */}
          <Route
            path="/app"
            element={
              <Layout>
                <AppMain />
              </Layout>
            }
          />
          <Route
            path="/resumes"
            element={
              <Layout>
                <Resumes />
              </Layout>
            }
          />
          <Route
            path="/account"
            element={
              <Layout>
                <Account />
              </Layout>
            }
          />
        </Routes>
      </Router>
    </div>
  );
};

export default App;