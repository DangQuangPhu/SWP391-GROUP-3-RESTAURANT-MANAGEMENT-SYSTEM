import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const CATEGORY_COLORS = {
  'food': '#8c764b',        // Gold
  'drink': '#6b5b39',       // Dark Gold
  'combo': '#a89468',       // Light Gold
  'dessert': '#c4b593',     // Pale Gold
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm text-sm font-sans">
        <p className="m-0 mb-1 font-semibold text-gray-500">{label}</p>
        <p className="m-0 font-bold text-gray-900 text-base">
          {`${Math.round(payload[0].value).toLocaleString('vi-VN')} VND`}
        </p>
      </div>
    );
  }
  return null;
};

export const ExpenditureTrendChart = ({ data }) => {
  return (
    <div className="w-full h-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8c764b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#8c764b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 500 }} 
            dy={10}
            tickFormatter={(val) => {
              if (!val) return '';
              // If it's hourly format "HH:00"
              if (val.includes(':')) {
                return val;
              }
              // If it's daily format "yyyy-MM-dd"
              if (val.length === 10) {
                const date = new Date(val);
                if (!isNaN(date.getTime())) {
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              }
              // If it's monthly format "yyyy-MM"
              if (val.length === 7) {
                const date = new Date(val + '-02'); // Add '-02' to avoid timezone shifts
                if (!isNaN(date.getTime())) {
                  return date.toLocaleDateString('en-US', { month: 'short' });
                }
              }
              return val;
            }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 500 }}
            tickFormatter={(value) => value >= 1000000 ? `${(value/1000000).toFixed(1)}M VND` : value >= 1000 ? `${(value/1000).toFixed(0)}k VND` : `${value} VND`}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8c764b', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="#8c764b" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorTotal)" 
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const OrderCategoryChart = ({ data }) => {
  const chartData = useMemo(() => {
    const total = data.reduce((acc, curr) => acc + curr.count, 0) || 1;
    return data.map((d, i) => ({
      ...d,
      percent: Math.round((d.count / total) * 100),
      fill: CATEGORY_COLORS[d.category.toLowerCase()] || Object.values(CATEGORY_COLORS)[i % 4]
    }));
  }, [data]);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 w-full h-full">
      {/* Doughnut Chart */}
      <div className="w-full sm:w-1/2 flex-1 flex items-center justify-center relative min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
              itemStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="count"
              nameKey="category"
              animationDuration={1200}
              animationEasing="ease-out"
              stroke="none"
              cornerRadius={4}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill} 
                  style={{ outline: 'none', transition: 'transform 0.2s', transformOrigin: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Progress Bars */}
      <div className="w-full sm:w-1/2 flex flex-col gap-4">
        {chartData.map((d, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
              <span className="capitalize">{d.category} ({d.percent}%)</span>
              <span>{d.count}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${d.percent}%`, backgroundColor: d.fill }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
