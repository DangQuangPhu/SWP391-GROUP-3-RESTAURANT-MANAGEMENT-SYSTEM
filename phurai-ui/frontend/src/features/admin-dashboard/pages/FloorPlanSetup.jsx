import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import { Plus, Users, LayoutDashboard, Sparkles, CheckCircle2, AlertCircle, Edit2, Trash2, Power } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function FloorPlanSetup() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAreaId, setActiveAreaId] = useState(null);

  // Modal states
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);

  // Form states
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableStatus, setNewTableStatus] = useState('Inactive'); // Default Draft/Inactive for Admin
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaType, setNewAreaType] = useState('Standard');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFloorPlan();
  }, []);

  const fetchFloorPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/manager/floor-plan');
      if (res.success && res.data) {
        setAreas(res.data);
        if (res.data.length > 0 && !activeAreaId) {
          setActiveAreaId(res.data[0].area_id);
        }
      } else {
        setError(res.error || res.message || 'Failed to fetch floor plan data.');
      }
    } catch (err) {
      console.error('Error fetching floor plan:', err);
      setError(err.message || 'An error occurred while fetching floor plan.');
    } finally {
      setLoading(false);
    }
  };

  const activeArea = areas.find(a => a.area_id === activeAreaId) || null;

  // Natural deterministic sorting for tables
  const sortedTables = React.useMemo(() => {
    if (!activeArea || !activeArea.tables) return [];
    return [...activeArea.tables].sort((a, b) => {
      return a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [activeArea]);

  const totalSeats = React.useMemo(() => {
    if (!activeArea || !activeArea.tables) return 0;
    return activeArea.tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
  }, [activeArea]);

  const activeTablesCount = React.useMemo(() => {
    if (!activeArea || !activeArea.tables) return 0;
    return activeArea.tables.filter(t => t.table_status !== 'Inactive').length;
  }, [activeArea]);

  const draftTablesCount = React.useMemo(() => {
    if (!activeArea || !activeArea.tables) return 0;
    return activeArea.tables.filter(t => t.table_status === 'Inactive').length;
  }, [activeArea]);

  // Handle Add Area
  const handleCreateArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) {
      toast.error('Please enter an area name');
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiPost('/manager/areas', {
        area_name: newAreaName.trim(),
        area_type: newAreaType
      });
      if (res.success) {
        toast.success(`Area "${newAreaName}" created successfully!`);
        setNewAreaName('');
        setIsAddAreaModalOpen(false);
        await fetchFloorPlan();
      } else {
        toast.error(res.message || 'Failed to create area');
      }
    } catch (err) {
      toast.error(err.message || 'Error creating area');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Table
  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      toast.error('Please enter a table number/code');
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiPost('/manager/tables', {
        area_id: activeAreaId,
        table_number: newTableName.trim(),
        capacity: Number(newTableCapacity) || 4,
        table_status: newTableStatus // Default Inactive/Draft for Admin
      });
      if (res.success) {
        toast.success(`Table ${newTableName} created as ${newTableStatus === 'Inactive' ? 'Draft (Inactive)' : 'Active'}!`);
        setNewTableName('');
        setNewTableCapacity(4);
        setNewTableStatus('Inactive');
        setIsAddTableModalOpen(false);
        await fetchFloorPlan();
      } else {
        toast.error(res.message || 'Failed to create table');
      }
    } catch (err) {
      toast.error(err.message || 'Error creating table');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Table Active Status
  const handleToggleStatus = async (table) => {
    const nextStatus = table.table_status === 'Inactive' ? 'Available' : 'Inactive';
    try {
      const res = await apiPatch(`/manager/tables/${table.table_id}`, {
        table_status: nextStatus
      });
      if (res.success) {
        toast.success(`Table ${table.table_number} status updated to ${nextStatus}!`);
        await fetchFloorPlan();
      } else {
        toast.error(res.message || 'Failed to update table status');
      }
    } catch (err) {
      toast.error(err.message || 'Error updating status');
    }
  };

  // Handle Delete Table
  const handleDeleteTable = async (table) => {
    if (!window.confirm(`Are you sure you want to delete Table ${table.table_number}?`)) return;
    try {
      const res = await apiDelete(`/manager/tables/${table.table_id}`);
      if (res.success) {
        toast.success(`Table ${table.table_number} deleted.`);
        await fetchFloorPlan();
      } else {
        toast.error(res.message || 'Failed to delete table');
      }
    } catch (err) {
      toast.error(err.message || 'Error deleting table');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="Floor Plan Configuration"
        description="Configure restaurant areas and tables. New tables are saved as Draft (Inactive) by default until approved by Manager."
        primaryAction={{
          label: '+ Add Area',
          onClick: () => setIsAddAreaModalOpen(true),
        }}
      />

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#c8a96e]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : areas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <LayoutDashboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-900 font-semibold text-lg">No Areas Configured</p>
          <p className="text-gray-500 text-sm mt-1 mb-4">Click "+ Add Area" to create your first restaurant zone.</p>
          <button
            onClick={() => setIsAddAreaModalOpen(true)}
            className="adm-btn-gold"
          >
            + Add Area
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Area Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 overflow-x-auto scrollbar-hide" aria-label="Area Tabs">
              {areas.map((area) => {
                const isActive = activeAreaId === area.area_id;
                return (
                  <button
                    key={area.area_id}
                    onClick={() => setActiveAreaId(area.area_id)}
                    className={`
                      whitespace-nowrap py-3.5 px-4 border-b-2 font-semibold text-sm transition-all duration-200 flex items-center gap-2 rounded-t-lg
                      ${isActive
                        ? 'border-[#c8a96e] text-[#8b6e36] bg-amber-50/40'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                      }
                    `}
                  >
                    <span>{area.area_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-[#c8a96e] text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {area.tables.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Active Area Banner & Toolbar */}
          {activeArea && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">{activeArea.area_name}</h3>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider">
                      {activeArea.area_type || 'Zone'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Users size={14} className="text-[#c8a96e]" />
                      <strong>{totalSeats}</strong> Total Seats
                    </span>
                    <span>&bull;</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> {activeTablesCount} Active
                    </span>
                    <span>&bull;</span>
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <AlertCircle size={13} /> {draftTablesCount} Draft (Inactive)
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(159, 134, 85, 0.4)' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setIsAddTableModalOpen(true)}
                  className="adm-btn-gold"
                >
                  <Plus size={16} />
                  Add Table to {activeArea.area_name}
                </motion.button>
              </div>

              {/* Responsive Auto-Stretching Equal Spaced Table Cards Grid */}
              {sortedTables.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-600 font-medium">No tables in this area yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Click "+ Add Table" above to populate {activeArea.area_name}.</p>
                </div>
              ) : (
                <motion.div
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                >
                  <AnimatePresence>
                    {sortedTables.map((table) => {
                      const isInactive = table.table_status === 'Inactive';
                      return (
                        <motion.div
                          key={table.table_id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                          className={`
                            relative rounded-xl border p-4 bg-white transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between gap-3 group
                            ${isInactive
                              ? 'border-dashed border-amber-300 bg-amber-50/20'
                              : 'border-gray-200 hover:border-[#c8a96e]/60'
                            }
                          `}
                        >
                          {/* Card Top: Table Code & Capacity */}
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-base font-bold text-gray-900 tracking-tight">
                              {table.table_number}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                              <Users size={12} className="text-gray-500" />
                              {table.capacity} Seats
                            </span>
                          </div>

                          {/* Card Middle: Status Indicator */}
                          <div>
                            {isInactive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-800 text-xs font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Draft (Inactive)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {table.table_status || 'Active'}
                              </span>
                            )}
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(table)}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${isInactive ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
                              title={isInactive ? "Activate Table" : "Set to Draft"}
                            >
                              <Power size={12} />
                              {isInactive ? 'Activate' : 'Draft'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTable(table)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded.lg hover:bg-red-50 transition-colors"
                              title="Delete Table"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Table Modal */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-gray-100"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Add Table to {activeArea?.area_name}</h3>
              <button onClick={() => setIsAddTableModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Table Number / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PRE-05, T-12, VIP-01"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:border-[#c8a96e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Seating Capacity (Guests)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:border-[#c8a96e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Status</label>
                <select
                  value={newTableStatus}
                  onChange={(e) => setNewTableStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:border-[#c8a96e] bg-white"
                >
                  <option value="Inactive">Draft (Inactive - Hidden from Customers)</option>
                  <option value="Available">Available (Active - Visible immediately)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">Recommended: Keep as Draft until Manager verifies on floor.</p>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="adm-btn-gold"
                >
                  {submitting ? 'Creating…' : 'Create Table'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Area Modal */}
      {isAddAreaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-gray-100"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Add New Dining Area</h3>
              <button onClick={() => setIsAddAreaModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Area Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Terrace Garden, Rooftop Deck"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:border-[#c8a96e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Area Type</label>
                <select
                  value={newAreaType}
                  onChange={(e) => setNewAreaType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:border-[#c8a96e] bg-white"
                >
                  <option value="Standard">Standard Dining</option>
                  <option value="VIP">VIP Lounge</option>
                  <option value="Outdoor">Outdoor / Garden</option>
                  <option value="Bar">Bar / Counter</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddAreaModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="adm-btn-gold"
                >
                  {submitting ? 'Creating…' : 'Create Area'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
