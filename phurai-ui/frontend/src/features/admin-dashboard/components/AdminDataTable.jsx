/**
 * AdminDataTable — Reusable data table for Admin pages.
 *
 * Animation synchronized with Staff/Manager portal pattern:
 *   - Loading: SkeletonPresence + TableSkeleton (shimmer rows, fade-scale)
 *   - Data: AnimatePresence mode="wait" → listContainerVariants stagger on rows
 *   - Each row: listItemVariants (y: 20 → 0, Apple ease)
 *
 * Props:
 *   columns       array   — [{ header, key?, render? }] or string[]
 *   data          array   — data rows
 *   loading       bool
 *   emptyMessage  string
 */
import { motion, AnimatePresence } from 'framer-motion';
import {
  SkeletonPresence,
  TableSkeleton,
  listContainerVariants,
  listItemVariants,
  Skeleton,
} from '@/components/ui/Skeleton';

export default function AdminDataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available.',
}) {
  const colCount = columns.length;

  const tableHead = (
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
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <SkeletonPresence
          loading={loading}
          skeleton={
            <table className="w-full text-left border-collapse">
              {tableHead}
              <tbody className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns.map((_, colIdx) => (
                      <td key={colIdx} className="px-6 py-4">
                        <Skeleton className="w-24 h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <table className="w-full text-left border-collapse">
            {tableHead}
            <AnimatePresence mode="wait">
              {data && data.length > 0 ? (
                <motion.tbody
                  key="data-rows"
                  className="divide-y divide-gray-100"
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {data.map((row, rowIdx) => (
                    <motion.tr
                      key={row.id || row.user_id || row.audit_log_id || rowIdx}
                      variants={listItemVariants}
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
                            {col.render
                              ? col.render(row, rowIdx)
                              : val !== undefined
                              ? String(val)
                              : ''}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </motion.tbody>
              ) : (
                <tbody key="empty">
                  <tr>
                    <td
                      colSpan={colCount}
                      className="px-6 py-8 text-center text-sm text-gray-400"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                </tbody>
              )}
            </AnimatePresence>
          </table>
        </SkeletonPresence>
      </div>
    </div>
  );
}
