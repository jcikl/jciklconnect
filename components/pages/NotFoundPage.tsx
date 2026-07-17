import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
    <p className="text-7xl font-black text-jci-navy mb-4">404</p>
    <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
    <p className="text-slate-500 mb-8 max-w-sm">
      The page you are looking for does not exist or has been moved.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-2 bg-jci-navy text-white font-semibold px-6 py-3 rounded-lg hover:bg-jci-blue transition-colors"
    >
      ← Back to Home
    </Link>
  </div>
);
