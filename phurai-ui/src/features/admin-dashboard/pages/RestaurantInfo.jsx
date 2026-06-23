import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import { toast } from 'react-hot-toast';
import { Store, MapPin, Phone, Mail, Clock } from 'lucide-react';

export default function RestaurantInfo() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    'RESTAURANT_NAME': '',
    'RESTAURANT_ADDRESS': '',
    'RESTAURANT_PHONE': '',
    'RESTAURANT_EMAIL': '',
    'OPERATING_HOURS': '',
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/admin/settings');
      if (res.success && res.data) {
        setSettings(res.data);
        
        // Initialize form data from fetched settings
        const initialData = { ...formData };
        res.data.forEach(setting => {
          if (initialData[setting.setting_key] !== undefined) {
            initialData[setting.setting_key] = setting.setting_value;
          }
        });
        setFormData(initialData);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error('Failed to load restaurant information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Construct payload to save settings
      const updates = Object.keys(formData).map(key => ({
        setting_key: key,
        setting_value: formData[key]
      }));

      // Assuming API supports batch update or we update one by one. 
      // Existing adminSettingsController typically expects { setting_key, setting_value, description }
      // We will do a simple loop for safety if batch is not supported, or just send array.
      // Assuming apiPut('/admin/settings', updates) works or we update individually
      
      for (const update of updates) {
        await apiPut('/admin/settings', update);
      }

      toast.success('Restaurant information updated successfully.');
      fetchSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save some information.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <AdminPageHeader
        title="Restaurant Information"
        description="Update the public-facing details of Phūrai Restaurant."
        primaryAction={{
          label: saving ? 'Saving...' : 'Save Changes',
          onClick: handleSave,
          disabled: loading || saving
        }}
      />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c764b]"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Store className="w-4 h-4 mr-2 text-gray-400" />
                  Restaurant Name
                </label>
                <input
                  type="text"
                  name="RESTAURANT_NAME"
                  value={formData.RESTAURANT_NAME}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#8c764b] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. Phūrai Premium"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  Contact Phone
                </label>
                <input
                  type="text"
                  name="RESTAURANT_PHONE"
                  value={formData.RESTAURANT_PHONE}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#8c764b] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 1900 1234"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  Address
                </label>
                <input
                  type="text"
                  name="RESTAURANT_ADDRESS"
                  value={formData.RESTAURANT_ADDRESS}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#8c764b] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 123 Nguyen Van Linh, District 7"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="RESTAURANT_EMAIL"
                  value={formData.RESTAURANT_EMAIL}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#8c764b] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. contact@phurai.com"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Clock className="w-4 h-4 mr-2 text-gray-400" />
                  Operating Hours
                </label>
                <input
                  type="text"
                  name="OPERATING_HOURS"
                  value={formData.OPERATING_HOURS}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#8c764b] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. 08:00 - 22:00"
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
