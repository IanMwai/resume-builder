import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // ← includes Tailwind styles
import App from './App'; // ← ensure this path is correct

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);