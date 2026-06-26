import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, RefreshCcw } from 'lucide-react';

export default function PaymentFailed({ onRetry }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center border border-red-100 dark:border-red-900"
      >
        <motion.div
          animate={{ x: [-10, 10, -10, 10, 0] }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="mb-6 rounded-full bg-red-100 dark:bg-red-900/30 p-4"
        >
          <XCircle className="w-20 h-20 text-red-500" strokeWidth={1.5} />
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Payment Failed
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Payment failed or expired. Please try again.
        </p>

        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200"
        >
          <RefreshCcw className="w-5 h-5" />
          <span>Tạo mã QR mới</span>
        </button>
      </motion.div>
    </div>
  );
}
