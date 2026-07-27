import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPut } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import { FormSkeleton } from '@/components/ui/Skeleton';

// ─── Minimal Vector Icons (No Emoji Stickers) ──────────────────────────────────
const ClockIcon = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CreditCardIcon = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const SlidersIcon = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-4 0h4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ─── Custom Apple Select Component ─────────────────────────────────────────────
function AppleSelect({ value, onChange, options, label, description }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

  return (
    <div className="space-y-1.5 relative" ref={dropdownRef}>
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f5f5f7] hover:bg-gray-200/80 border border-gray-200/60 rounded-xl shadow-xs text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all duration-200"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-900" />
          {selectedOption?.label || value}
        </span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-30 w-full mt-1.5 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-xl p-1.5 space-y-1"
          >
            {options.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isSelected
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}

// ─── Custom Apple Stepper Component ───────────────────────────────────────────
function AppleNumberStepper({ value, onChange, min = 0, max = 999, label, description, suffix = '' }) {
  const numValue = Number(value) || 0;

  const handleDecrement = () => {
    if (numValue > min) onChange(numValue - 1);
  };

  const handleIncrement = () => {
    if (numValue < max) onChange(numValue + 1);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between px-4 py-2.5 bg-[#f5f5f7] border border-gray-200/60 rounded-xl shadow-xs">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent font-semibold text-gray-900 text-sm focus:outline-none"
            min={min}
            max={max}
          />
          {suffix && <span className="text-xs font-semibold text-gray-400 ml-1">{suffix}</span>}
        </div>
        <div className="flex items-center gap-1 bg-[#e8e8ed] p-1 rounded-xl">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={handleDecrement}
            disabled={numValue <= min}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-xs text-gray-800 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold transition-all"
          >
            −
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={handleIncrement}
            disabled={numValue >= max}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-xs text-gray-800 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold transition-all"
          >
            +
          </motion.button>
        </div>
      </div>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}

// ─── Custom Apple Closed Days Segmented Pill Component ─────────────────────────
function AppleClosedDaysSelector({ value = '', onChange, label, description }) {
  const DAYS = [
    { short: 'Mon', full: 'Monday' },
    { short: 'Tue', full: 'Tuesday' },
    { short: 'Wed', full: 'Wednesday' },
    { short: 'Thu', full: 'Thursday' },
    { short: 'Fri', full: 'Friday' },
    { short: 'Sat', full: 'Saturday' },
    { short: 'Sun', full: 'Sunday' },
  ];

  const selectedDays = useMemo(() => {
    return value
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }, [value]);

  const toggleDay = (fullDayName) => {
    let nextDays;
    const exists = selectedDays.some((d) => d.toLowerCase() === fullDayName.toLowerCase());
    if (exists) {
      nextDays = selectedDays.filter((d) => d.toLowerCase() !== fullDayName.toLowerCase());
    } else {
      nextDays = [...selectedDays, fullDayName];
    }
    onChange(nextDays.join(', '));
  };

  return (
    <div className="space-y-3 col-span-full bg-[#f5f5f7] border border-gray-200/60 p-5 rounded-2xl">
      <div className="flex items-center justify-between">
        {label && <label className="block text-xs font-semibold uppercase tracking-wider text-gray-800">{label}</label>}
        <span className="text-xs font-semibold text-gray-500">
          {selectedDays.length > 0 ? `${selectedDays.length} closed day(s)` : 'Open all 7 days'}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAYS.map(({ short, full }) => {
          const isSelected = selectedDays.some((d) => d.toLowerCase() === full.toLowerCase());
          return (
            <motion.button
              whileTap={{ scale: 0.96 }}
              key={full}
              type="button"
              onClick={() => toggleDay(full)}
              className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all duration-200 flex flex-col items-center justify-center border ${
                isSelected
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200/80 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <span>{short}</span>
              <span className={`text-[10px] mt-0.5 font-normal ${isSelected ? 'text-gray-300 font-medium' : 'text-gray-400'}`}>
                {isSelected ? 'Closed' : 'Open'}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="pt-1">
        <label className="block text-[11px] font-medium text-gray-500 mb-1">
          Custom Holiday Dates / Note (e.g. 2026-07-27, 2026-12-25):
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Sunday, Monday or 2026-07-27"
          className="w-full px-3.5 py-2.5 bg-white border border-gray-200/80 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );
}

// ─── Smart Schedule Input With Apple Preset Badges ────────────────────────────
function AppleScheduleInput({ value, onChange, label, description, presets = [] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label && <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</label>}
        {presets.length > 0 && (
          <div className="flex items-center gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#e8e8ed] hover:bg-gray-300 text-gray-700 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
      />
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}

// ─── Main System Settings Page ────────────────────────────────────────────────
export default function SystemSettings() {
  const [settings, setSettings] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter Bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/admin/settings');
      if (res.success && res.data) {
        setSettings(res.data);
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

  const getValue = (key, fallback = '') => (formData[key] !== undefined ? formData[key] : fallback);

  const handleOpenCloseTimeChange = (key, timeVal) => {
    setFormData((prev) => {
      const nextOpen = key === 'open_time' ? timeVal : (prev.open_time || '10:00');
      const nextClose = key === 'close_time' ? timeVal : (prev.close_time || '22:00');

      const to12h = (t) => {
        if (!t || !t.includes(':')) return '';
        let [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
      };

      const autoRange = `${to12h(nextOpen)} — ${to12h(nextClose)}`;

      return {
        ...prev,
        [key]: timeVal,
        hours_mon_thu: autoRange,
        hours_fri_sat: autoRange,
        hours_sunday: prev.hours_sunday === 'Closed' ? 'Closed' : autoRange,
      };
    });
    setSuccessMsg(null);
  };

  const currentOpen = getValue('open_time', '10:00');
  const currentClose = getValue('close_time', '22:00');

  const dynamicOpenCloseRange = useMemo(() => {
    if (!currentOpen || !currentClose || !currentOpen.includes(':') || !currentClose.includes(':')) return '';
    const to12h = (tStr) => {
      let [h, m] = tStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    return `${to12h(currentOpen)} — ${to12h(currentClose)}`;
  }, [currentOpen, currentClose]);

  const dynamicSchedulePresets = useMemo(() => {
    const list = [];
    if (dynamicOpenCloseRange) {
      list.push(dynamicOpenCloseRange);
    }
    if (!list.includes('7:00 AM — 12:00 AM')) list.push('7:00 AM — 12:00 AM');
    list.push('Closed');
    return list;
  }, [dynamicOpenCloseRange]);

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

      const payload = Object.keys(formData).map((key) => ({
        setting_key: key,
        setting_value: String(formData[key]),
      }));

      const res = await apiPut('/admin/settings', payload);
      if (res.success) {
        setSuccessMsg('System settings saved successfully! All reservation rules and footer timing synced.');
        window.dispatchEvent(new Event('phurai_settings_updated'));
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

  // Category filter check helper
  const matchesSearch = (textStr) => {
    if (!searchQuery.trim()) return true;
    return textStr.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showSchedules = (activeCategory === 'All' || activeCategory === 'Schedules') && matchesSearch('operating hours schedule open close time closed days sunday fri mon thu happy');
  const showPolicies = (activeCategory === 'All' || activeCategory === 'Policies') && matchesSearch('reservation deposit party size threshold max guests service charge');
  const showRules = (activeCategory === 'All' || activeCategory === 'Rules') && matchesSearch('table hold minutes cancel deadline no show grace cleaning buffer');
  const showGeneral = (activeCategory === 'All' || activeCategory === 'General') && matchesSearch('restaurant display name address phone email contact general info');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen">
      <AdminPageHeader
        title="System Settings"
        description="Configure core restaurant operations, operating schedules, closed day policies, and deposit requirements."
      />

      {/* Apple Smart Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f5f5f7] p-3 rounded-2xl border border-gray-200/60">
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200/80 shadow-xs flex-1 max-w-md">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search settings (e.g. deposit, hours, grace)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-gray-900 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['All', 'Schedules', 'Policies', 'Rules', 'General'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-white/60 hover:bg-white text-gray-600 hover:text-gray-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <FormSkeleton items={8} />
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-red-700 text-sm shadow-xs">
          {error}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-emerald-900 text-sm flex items-center gap-3 shadow-xs font-medium"
            >
              <svg className="h-5 w-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Section 1: Operating Hours & Schedule */}
          {showSchedules && (
            <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ClockIcon />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Operating Hours & Schedule</h3>
                  <p className="text-xs text-gray-500">
                    Defines restaurant opening hours, weekly schedule, and closed/holiday notifications for Footer and Online Reservation.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Open Time */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Open Time</label>
                  <input
                    type="time"
                    value={getValue('open_time', '10:00')}
                    onChange={(e) => handleOpenCloseTimeChange('open_time', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                  />
                  <p className="text-xs text-gray-400">Time when restaurant opens for online bookings.</p>
                </div>

                {/* Close Time */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Close Time</label>
                  <input
                    type="time"
                    value={getValue('close_time', '22:00')}
                    onChange={(e) => handleOpenCloseTimeChange('close_time', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                  />
                  <p className="text-xs text-gray-400">Closing time for restaurant bookings.</p>
                </div>

                {/* Closed Days Multi-Pill Selector */}
                <AppleClosedDaysSelector
                  label="Closed Days / Weekly Day Off"
                  value={getValue('closed_days', '')}
                  onChange={(val) => handleChange('closed_days', val)}
                  description="Selected days will display 'Thông báo Tạm Nghỉ' banner on Reservation UI and disable time slot selection."
                />

                {/* Schedule Mon - Thu */}
                <AppleScheduleInput
                  label="Hours: Mon — Thu"
                  value={getValue('hours_mon_thu', '7:00 AM — 12:00 AM')}
                  onChange={(val) => handleChange('hours_mon_thu', val)}
                  presets={dynamicSchedulePresets}
                  description="Displayed in website footer for Monday - Thursday."
                />

                {/* Schedule Fri - Sat */}
                <AppleScheduleInput
                  label="Hours: Fri — Sat"
                  value={getValue('hours_fri_sat', '7:00 AM — 12:00 AM')}
                  onChange={(val) => handleChange('hours_fri_sat', val)}
                  presets={dynamicSchedulePresets}
                  description="Displayed in website footer for Friday - Saturday."
                />

                {/* Schedule Sunday */}
                <AppleScheduleInput
                  label="Hours: Sunday"
                  value={getValue('hours_sunday', '7:00 PM — 10:00 PM')}
                  onChange={(val) => handleChange('hours_sunday', val)}
                  presets={dynamicSchedulePresets}
                  description="Displayed in website footer for Sunday."
                />

                {/* Happy Hour */}
                <AppleScheduleInput
                  label="Hours: Happy Hour"
                  value={getValue('hours_happy', '4:00 PM — 7:00 PM Daily')}
                  onChange={(val) => handleChange('hours_happy', val)}
                  presets={['4:00 PM — 7:00 PM Daily', '5:00 PM — 8:00 PM Daily']}
                  description="Happy Hour promotional timing badge in footer."
                />
              </div>
            </div>
          )}

          {/* Section 2: Reservation & Deposit Policies */}
          {showPolicies && (
            <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <CreditCardIcon />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reservation & Deposit Policies</h3>
                  <p className="text-xs text-gray-500">
                    Configure deposit rules, maximum guests per booking, and service charge percentages.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Deposit Min Table Tier Select */}
                <AppleSelect
                  label="Deposit Min Table Tier"
                  value={getValue('deposit_min_table_tier', 'VIP')}
                  onChange={(val) => handleChange('deposit_min_table_tier', val)}
                  options={[
                    { value: 'Standard', label: 'Standard Tier (All Tables)' },
                    { value: 'Premium', label: 'Premium Tier & Above' },
                    { value: 'VIP', label: 'VIP Tier Only' },
                  ]}
                  description="Minimum table tier required to trigger deposit payment."
                />

                {/* Deposit Party Size Threshold Stepper */}
                <AppleNumberStepper
                  label="Deposit Party Size Threshold"
                  value={getValue('deposit_party_size_threshold', '8')}
                  onChange={(val) => handleChange('deposit_party_size_threshold', val)}
                  min={1}
                  max={50}
                  suffix="guests"
                  description="Bookings with party size greater or equal to this limit require deposit."
                />

                {/* Max Guests Stepper */}
                <AppleNumberStepper
                  label="Max Guests Per Reservation"
                  value={getValue('max_guests', '12')}
                  onChange={(val) => handleChange('max_guests', val)}
                  min={1}
                  max={100}
                  suffix="guests"
                  description="Maximum guests allowed for online booking before contacting hotline."
                />

                {/* Service Charge Stepper */}
                <AppleNumberStepper
                  label="Service Charge Percent"
                  value={getValue('service_charge', '5')}
                  onChange={(val) => handleChange('service_charge', val)}
                  min={0}
                  max={30}
                  suffix="%"
                  description="Service charge added to booking invoice total."
                />
              </div>
            </div>
          )}

          {/* Section 3: Table Hold & Cleaning Rules */}
          {showRules && (
            <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <SlidersIcon />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Table Hold & Cleaning Rules</h3>
                  <p className="text-xs text-gray-500">
                    Buffer minutes and cancellation deadline settings for floor plan and staff management.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Table Hold Min Stepper */}
                <AppleNumberStepper
                  label="Table Hold Minutes"
                  value={getValue('table_hold_min', '15')}
                  onChange={(val) => handleChange('table_hold_min', val)}
                  min={5}
                  max={60}
                  suffix="min"
                  description="Minutes a reserved table is held after scheduled arrival."
                />

                {/* Cancel Deadline H Stepper */}
                <AppleNumberStepper
                  label="Cancel Deadline Hours"
                  value={getValue('cancel_deadline_h', '2')}
                  onChange={(val) => handleChange('cancel_deadline_h', val)}
                  min={1}
                  max={48}
                  suffix="hrs"
                  description="Hours before reservation start time to allow penalty-free cancellation."
                />

                {/* No Show Grace Default Min Stepper */}
                <AppleNumberStepper
                  label="No Show Grace Period"
                  value={getValue('no_show_grace_default_min', '20')}
                  onChange={(val) => handleChange('no_show_grace_default_min', val)}
                  min={5}
                  max={60}
                  suffix="min"
                  description="Grace period in minutes before auto-marking reservation as No-Show."
                />

                {/* Cleaning Buffer Min Stepper */}
                <AppleNumberStepper
                  label="Cleaning Buffer Minutes"
                  value={getValue('cleaning_buffer_min', '15')}
                  onChange={(val) => handleChange('cleaning_buffer_min', val)}
                  min={5}
                  max={60}
                  suffix="min"
                  description="Turnaround time added after dining to clean table for next guests."
                />
              </div>
            </div>
          )}

          {/* Section 4: General Restaurant Information */}
          {showGeneral && (
            <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <BuildingIcon />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">General Restaurant Information</h3>
                  <p className="text-xs text-gray-500">Public-facing brand details displayed on website, emails, and footer.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Restaurant Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Restaurant Display Name</label>
                  <input
                    type="text"
                    value={getValue('restaurant_name', 'Phūrai Premium Restaurant')}
                    onChange={(e) => handleChange('restaurant_name', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                    placeholder="e.g. Phūrai Premium Restaurant"
                  />
                  <p className="text-xs text-gray-400">Official brand title displayed on confirmation emails and header.</p>
                </div>

                {/* Contact Phone */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Contact Phone</label>
                  <input
                    type="tel"
                    value={getValue('restaurant_phone', '')}
                    onChange={(e) => handleChange('restaurant_phone', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                    placeholder="e.g. 1900 1234"
                  />
                  <p className="text-xs text-gray-400">Phone number shown in website footer and contact page.</p>
                </div>

                {/* Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Restaurant Address</label>
                  <input
                    type="text"
                    value={getValue('restaurant_address', '')}
                    onChange={(e) => handleChange('restaurant_address', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                    placeholder="e.g. 123 Nguyen Van Linh, District 7"
                  />
                  <p className="text-xs text-gray-400">Full address displayed on the website footer and contact page.</p>
                </div>

                {/* Email */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Contact Email</label>
                  <input
                    type="email"
                    value={getValue('restaurant_email', '')}
                    onChange={(e) => handleChange('restaurant_email', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border border-gray-200/60 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white"
                    placeholder="e.g. contact@phurai.com"
                  />
                  <p className="text-xs text-gray-400">Business email shown in website footer and confirmation messages.</p>
                </div>
              </div>
            </div>
          )}

          {/* Floating Save Bar */}
          <div className="sticky bottom-6 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-bold text-white bg-gray-900 hover:bg-black active:bg-gray-800 disabled:bg-gray-300 rounded-2xl shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving Settings...
                </>
              ) : (
                'Save Settings & Sync'
              )}
            </motion.button>
          </div>
        </form>
      )}
    </div>
  );
}
