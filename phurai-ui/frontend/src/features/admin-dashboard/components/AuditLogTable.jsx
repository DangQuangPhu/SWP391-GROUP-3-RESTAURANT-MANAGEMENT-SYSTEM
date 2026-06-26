import React, { useState, useEffect } from 'react';
import { apiGet } from '@/core/api/httpClient';
import { Eye, Clock, User, Target, Search } from 'lucide-react';

const safeParseJSON = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return jsonString; // return raw if parse fails
  }
};

const JsonViewer = ({ data }) => {
  if (!data) return <span className="text-gray-400 italic">N/A</span>;
  if (typeof data === 'string') {
    return <span className="text-red-500 font-mono text-sm break-all">{data}</span>;
  }
  return (
    <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono overflow-x-auto text-blue-600 dark:text-blue-400">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
};

export default function AuditLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await apiGet('/admin/audit-logs');
      if (res.success) setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.action_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target_table?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12">Loading audit logs...</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-indigo-500" />
          System Audit Logs
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3 w-1/4">Old Value</th>
              <th className="px-4 py-3 w-1/4">New Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {filteredLogs.map(log => (
              <tr key={log.log_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {new Date(log.created_at).toLocaleString('vi-VN')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">{log.full_name || `User ${log.user_id}`}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    log.action_name.includes('FORCE_SETTLE') 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200' 
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                  }`}>
                    {log.action_name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs">
                    <Target className="w-3 h-3" />
                    {log.target_table} <span className="text-gray-400">#{log.target_id}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <JsonViewer data={safeParseJSON(log.old_value_json)} />
                </td>
                <td className="px-4 py-3">
                  <JsonViewer data={safeParseJSON(log.new_value_json)} />
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
