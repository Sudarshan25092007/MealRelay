import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EditDonationModal from '../components/EditDonationModal';

export default function DonationDetailPage({ donationId, onBack }) {
  const { user } = useAuth();
  const [donation, setDonation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getDonationById(donationId);
      if (res.success) {
        setDonation(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load donation details');
    } finally {
      setIsLoading(false);
    }
  }, [donationId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-8 bg-slate-200 rounded w-3/4"></div>
          <div className="h-20 bg-slate-100 rounded w-full"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 bg-slate-100 rounded"></div>
            <div className="h-16 bg-slate-100 rounded"></div>
            <div className="h-16 bg-slate-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !donation) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            ✕
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Cannot Load Offer</h2>
          <p className="text-xs text-slate-600 mb-6">{error || 'Offer not found or access restricted.'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
          >
            &larr; Return to Browse Feed
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user?.organizationId === donation.donorOrganizationId || user?.role === 'ADMIN';
  const canEdit = isOwner && donation.status === 'OPEN';

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Bar with Back and Actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition-colors shadow-2xs"
        >
          &larr; Back to Listings
        </button>

        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Surplus Offer
          </button>
        )}
      </div>

      {/* Main Detail Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        {/* Banner with status and category */}
        <div className="p-6 sm:p-8 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                donation.status === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              Status: {donation.status}
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              Category: {donation.foodType}
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Quantity: {donation.quantity} {donation.unit}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            {donation.title}
          </h1>

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {donation.description}
          </p>
        </div>

        {/* Timelines and Schedule */}
        <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Critical Food Safety & Pickup Schedule
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Prepared At
              </span>
              <span className="text-sm font-bold text-slate-800">
                {formatDateTime(donation.preparedAt)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide block mb-1">
                Pickup Deadline
              </span>
              <span className="text-sm font-bold text-amber-900">
                {formatDateTime(donation.pickupDeadline)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Consume By
              </span>
              <span className="text-sm font-bold text-slate-800">
                {formatDateTime(donation.consumeBy)}
              </span>
            </div>
          </div>
        </div>

        {/* Donor Organization Profile */}
        <div className="p-6 sm:p-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Donor Organization & Location
          </h2>

          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {donation.donorOrganization?.name || 'Verified Food Donor'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {donation.donorOrganization?.address}, {donation.donorOrganization?.locality}
              </p>
            </div>

            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800">
              ✓ Verified Donor
            </span>
          </div>
        </div>

        {/* Audit Log Timeline (Phase 1 preview) */}
        {donation.auditEvents && donation.auditEvents.length > 0 && (
          <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Platform Audit History
            </h2>
            <div className="space-y-2">
              {donation.auditEvents.map((evt) => (
                <div key={evt.id} className="text-xs text-slate-600 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-semibold text-slate-700">{evt.action}</span>
                  <span className="text-slate-400">•</span>
                  <span>{new Date(evt.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <EditDonationModal
          donation={donation}
          onClose={() => setIsEditing(false)}
          onUpdated={(updated) => {
            setDonation(updated);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
}
