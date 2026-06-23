import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';

export default function SystemSettings() {
  const [settings, setSettings] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/admin/settings');
      if (res.success && res.data) {
        setSettings(res.data);
        // Map list to form state
        const initialForm = {};
        res.data.forEach((item) => {
          initialForm[item.setting_key] = item.setting_value;
        });
        setFormData(initialForm);
      } else {
        setError('Failed to fetch system settings.');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'An error occurred while fetching settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSuccessMsg(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      // Convert formData state back to the array expected by server
      const payload = Object.keys(formData).map((key) => ({
        setting_key: key,
        setting_value: String(formData[key]),
      }));

      const res = await apiPut('/admin/settings', payload);
      if (res.success) {
        setSuccessMsg('System settings updated successfully!');
        // Refresh settings list to be sure
        await fetchSettings();
      } else {
        setError(res.message || 'Failed to update system settings.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message || 'An error occurred while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to get formatted setting key labels
  const formatLabel = (key) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="System Settings"
        description="Configure core restaurant operations, reservation properties, schedules, and policies."
      />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c764b]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-emerald-700 text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settings.map((item) => {
                const key = item.setting_key;
                const value = formData[key] || '';
                const desc = item.description || '';

                // Render different input types based on setting key
                let inputType = 'text';
                if (key.includes('time')) {
                  inputType = 'time';
                } else if (key.includes('max_') || key.includes('hold') || key.includes('charge') || key.includes('deadline')) {
                  inputType = 'number';
                }

                return (
                  <div key={key} className="space-y-1.5">
                    <label htmlFor={key} className="block text-sm font-semibold text-gray-700">
                      {formatLabel(key)}
                    </label>
                    <input
                      id={key}
                      type={inputType}
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8c764b] focus:border-[#8c764b] focus:bg-white transition-all duration-150"
                      required
                    />
                    {desc && <p className="text-xs text-gray-400 mt-1">{desc}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#8c764b] hover:bg-[#846d44] active:bg-[#725e39] disabled:bg-gray-300 rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8c764b]"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving Changes...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
