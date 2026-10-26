import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import BrowseDonationsPage from './pages/BrowseDonationsPage';
import DonationDetailPage from './pages/DonationDetailPage';
import CreateDonationPage from './pages/CreateDonationPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('browse');
  const [selectedDonationId, setSelectedDonationId] = useState(null);

  const handleSelectDonation = (id) => {
    setSelectedDonationId(id);
    setCurrentView('donation-detail');
  };

  const handleCreatedDonation = (newId) => {
    setSelectedDonationId(newId);
    setCurrentView('donation-detail');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar currentView={currentView} setView={setCurrentView} />

      <main className="flex-1">
        {currentView === 'browse' && (
          <BrowseDonationsPage
            onSelectDonation={handleSelectDonation}
            isOwnerView={false}
          />
        )}

        {currentView === 'my-donations' && (
          <BrowseDonationsPage
            onSelectDonation={handleSelectDonation}
            isOwnerView={true}
          />
        )}

        {currentView === 'donation-detail' && selectedDonationId && (
          <DonationDetailPage
            donationId={selectedDonationId}
            onBack={() => setCurrentView('browse')}
          />
        )}

        {currentView === 'create-donation' && (
          <CreateDonationPage
            onCreated={handleCreatedDonation}
            onCancel={() => setCurrentView('browse')}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onLoginSuccess={() => setCurrentView('browse')}
            onGoToRegister={() => setCurrentView('register')}
          />
        )}

        {currentView === 'register' && (
          <RegisterPage
            onRegisterSuccess={() => setCurrentView('dashboard')}
            onGoToLogin={() => setCurrentView('login')}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardPage
            setView={setCurrentView}
            onSelectDonation={handleSelectDonation}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">MealRelay Platform</span>
            <span>•</span>
            <span>Surplus-Food Recovery Coordination</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Phase 1 Backend Core & Frontend Shell
            </span>
          </div>
          <div>
            Built with React, Vite, Node.js, Express, PostgreSQL & Prisma
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
