import React, { useState, useEffect } from 'react';
import { apiGet, request, authHeaders } from '@/core/api/httpClient';
import { Save, RefreshCw } from 'lucide-react';

export default function SettingsEditor() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiGet('/admin/settings');
      if (res.success) setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (index, newValue) => {
    const newSettings = [...settings];
    newSettings[index].setting_value = newValue;
    setSettings(newSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await request('/admin/settings', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ settings }) });
      if (res.success) {
        alert('Settings saved successfully!');
      } else {
        alert(res.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      alert('Internal error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden max-w-4xl mx-auto">
      <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white text-lg">Global Settings</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage restaurant configurations. Changes apply immediately.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchSettings}
            className="p-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {settings.map((setting, index) => (
          <div key={setting.setting_key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 font-mono text-sm mb-1">{setting.setting_key}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{setting.description || 'No description available.'}</p>
            </div>
            <div className="w-full md:w-1/3">
              <input 
                type="text" 
                value={setting.setting_value || ''}
                onChange={(e) => handleSettingChange(index, e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
