import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import CapacityLimitModal from '@/features/admin-dashboard/components/CapacityLimitModal';
import { Plus, Edit2, Users, LayoutDashboard } from 'lucide-react';

export default function FloorPlanSetup() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  const MAX_TABLES_PER_AREA = 15; // Synced with backend limit

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
        if (res.data.length > 0) {
          setActiveAreaId(res.data[0].area_id);
        }
      } else {
        setError(res.message || 'Failed to fetch floor plan data.');
      }
    } catch (err) {
      console.error('Error fetching floor plan:', err);
      setError(err.message || 'An error occurred while fetching floor plan.');
    } finally {
      setLoading(false);
    }
  };

  const activeArea = areas.find(a => a.area_id === activeAreaId) || null;

  const handleAddTable = () => {
    if (activeArea && activeArea.tables.length >= MAX_TABLES_PER_AREA) {
      setIsLimitModalOpen(true);
      return;
    }
    alert('Add table coming soon!');
  };

  const handleEditTable = (table) => {
    alert(`Edit table ${table.table_number} coming soon!`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="Floor Plan Configuration"
        description="Design your restaurant layout, manage table capacities, and organize areas."
        primaryAction={{ label: 'Add Area', onClick: () => alert('Add Area coming soon!') }}
      />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c764b]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500">No areas found. Please add an area first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
              {areas.map((area) => (
                <button
                  key={area.area_id}
                  onClick={() => setActiveAreaId(area.area_id)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${activeAreaId === area.area_id
                      ? 'border-[#8c764b] text-[#8c764b]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {area.area_name}
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activeAreaId === area.area_id ? 'bg-[#8c764b]/10 text-[#8c764b]' : 'bg-gray-100 text-gray-600'}`}>
                    {area.tables.length}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Active Area Canvas */}
          {activeArea && (
            <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-8 min-h-[500px]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activeArea.area_name}</h3>
                  <p className="text-sm text-gray-500">{activeArea.area_type} Area &bull; {activeArea.tables.length} Tables</p>
                </div>
                <button 
                  onClick={handleAddTable}
                  className="inline-flex items-center px-4 py-2 border border-[#8c764b] text-[#8c764b] text-sm font-medium rounded-lg hover:bg-[#8c764b] hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8c764b]"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Table
                </button>
              </div>

              <div className="flex flex-wrap gap-8 items-center justify-start p-4">
                {activeArea.tables.map(table => {
                  // Determine shape class
                  let shapeClass = "w-24 h-24 rounded-xl"; // Default square (<=4 pax)
                  if (table.is_counter) {
                    shapeClass = "w-20 h-20 rounded-full"; // Circle
                  } else if (table.capacity > 4) {
                    shapeClass = "w-32 h-24 rounded-xl"; // Rectangle (>4 pax)
                  }

                  const isInactive = !table.is_active;

                  return (
                    <div 
                      key={table.table_id}
                      className={`relative group flex items-center justify-center bg-white border-2 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-[#8c764b]/50 ${shapeClass} ${isInactive ? 'border-dashed border-gray-300 opacity-60' : 'border-gray-200'}`}
                    >
                      {/* Edit overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10 cursor-pointer"
                           style={{ borderRadius: 'inherit' }}
                           onClick={() => handleEditTable(table)}>
                        <Edit2 className="w-5 h-5 text-white drop-shadow-md" />
                      </div>

                      {/* Capacity badge */}
                      <div className="absolute -top-2 -right-2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-sm z-20">
                        <Users className="w-3 h-3 mr-1 opacity-80" />
                        {table.capacity}
                      </div>

                      {/* Table Number */}
                      <span className="text-2xl font-bold text-gray-700 font-mono tracking-tight">
                        {table.table_number}
                      </span>
                      
                      {isInactive && (
                        <div className="absolute -bottom-3 text-[10px] font-bold tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 z-20 shadow-sm uppercase">
                          Offline
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {activeArea.tables.length === 0 && (
                  <div className="w-full flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <LayoutDashboard className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-900 font-medium text-lg">No tables configured</p>
                    <p className="text-gray-500 text-sm mt-1 max-w-sm text-center">Get started by adding your first table to the {activeArea.area_name}.</p>
                    <button 
                      onClick={handleAddTable}
                      className="mt-6 inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add First Table
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Capacity Limit Restriction Modal */}
      <CapacityLimitModal 
        isOpen={isLimitModalOpen} 
        onClose={() => setIsLimitModalOpen(false)} 
      />
    </div>
  );
}
