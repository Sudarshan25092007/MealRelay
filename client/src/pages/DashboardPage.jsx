import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function DashboardPage({ setView, onSelectDonation }) {
  const { user, organization, isDonor, isApproved } = useAuth();
  const [stats, setStats] = useState({ openCount: 0, myCount: 0 });
  const [recentOffers, setRecentOffers] = useState([]);
  const [backendHealth, setBackendHealth] = useState('checking');

  useEffect(() => {
    // Check health
    api.checkHealth()
      .then((res) => setBackendHealth(res.status === 'ok' ? 'healthy' : 'degraded'))
      .catch(() => setBackendHealth('offline'));

    // Fetch live counts
    api.getDonations({ limit: 5 })
      .then((res) => {
        if (res.success) {
          setStats((prev) => ({ ...prev, openCount: res.pagination?.total || 0 }));
          setRecentOffers(res.data || []);
        }
      })
      .catch((err) => console.warn('Could not fetch public stats:', err.message));

    // Fetch my counts if donor
    if (isDonor) {
      api.getDonations({ my: 'true', limit: 1 })
        .then((res) => {
          if (res.success) {
            setStats((prev) => ({ ...prev, myCount: res.pagination?.total || 0 }));
          }
        })
        .catch(() => {});
    }
  }, [isDonor]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {user?.name}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {organization?.approvalStatus || 'PENDING'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Affiliated with <span className="font-semibold text-slate-800">{organization?.name}</span> ({organization?.type}) in{' '}
              <span className="font-semibold text-slate-800">{organization?.locality}</span>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {isDonor && isApproved && (
              <button
                onClick={() => setView('create-donation')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                + Post Surplus
              </button>
            )}
            <button
              onClick={() => setView('browse')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
            >
              Browse Feed
            </button>
          </div>
        </div>
      </div>

      {/* Verification Notice if Pending */}
      {!isApproved && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start space-x-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Account Approval Under Review
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              Your organization registration is pending review by MealRelay operations. While pending, you can browse open surplus donations. You will be able to publish donations (Donors) or claim offers (NGOs) once verified.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Active Community Surplus
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {stats.openCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Open donations across all localities
          </div>
        </div>

        {isDonor ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              My Organization Offers
            </div>
            <div className="text-3xl font-extrabold text-emerald-600">
              {stats.myCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Surplus packages coordinated by you
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Organization Role
            </div>
            <div className="text-3xl font-extrabold text-blue-600">
              {organization?.type || user?.role}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Eligible to discover recovery food
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            System & Database Health
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`w-3 h-3 rounded-full ${
                backendHealth === 'healthy'
                  ? 'bg-emerald-500'
                  : backendHealth === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            ></span>
            <span className="text-lg font-bold text-slate-900 capitalize">
              {backendHealth}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            PostgreSQL & Express API Operational
          </div>
        </div>
      </div>

      {/* Recent Offers Snippet */}
      {recentOffers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Recent Surplus Available for Pickup
            </h2>
            <button
              onClick={() => setView('browse')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View all ({stats.openCount}) &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOffers.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectDonation(item.id)}
                className="py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded-lg transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">{item.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.donorOrganization?.name} • {item.donorOrganization?.locality}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {item.quantity} {item.unit}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {item.foodType}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
