import React from 'react';

/**
 * Reusable data table component for admin dashboards.
 * 
 * Props:
 * - columns: Array of columns. Each item can be a string (acting as a column header/key),
 *            or an object: { header: 'Header Title', key: 'object_property', render: (row, index) => ReactNode }
 * - data: Array of data objects to display.
 * - emptyMessage: Custom message to display when data is empty.
 */
export default function AdminDataTable({ columns, data, emptyMessage = "No data available." }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {columns.map((col, idx) => {
                const headerText = typeof col === 'string' ? col : col.header;
                return (
                  <th
                    key={idx}
                    className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {headerText}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data && data.length > 0 ? (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || row.user_id || row.audit_log_id || rowIdx}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  {columns.map((col, colIdx) => {
                    if (typeof col === 'string') {
                      return (
                        <td key={colIdx} className="px-6 py-4 text-sm text-gray-600">
                          {row[col] !== undefined ? String(row[col]) : ''}
                        </td>
                      );
                    }

                    const val = col.key ? row[col.key] : undefined;
                    return (
                      <td key={colIdx} className="px-6 py-4 text-sm text-gray-700">
                        {col.render ? col.render(row, rowIdx) : (val !== undefined ? String(val) : '')}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-sm text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
