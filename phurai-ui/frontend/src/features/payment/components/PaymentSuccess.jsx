import React from 'react';
import { motion } from 'framer-motion';

export default function PaymentSuccess({ onComplete }) {
  const checkmarkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.5, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_0_40px_rgba(34,197,94,0.3)] p-10 max-w-sm w-full text-center flex flex-col items-center border border-green-100 dark:border-green-900/50"
      >
        <div className="relative mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 10 }}
            className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shadow-inner"
          >
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
                variants={checkmarkVariants}
                initial="hidden"
                animate="visible"
              />
            </svg>
          </motion.div>
          {/* Glowing ring */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 1.4] }}
            transition={{ delay: 0.5, duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-4 border-green-400 pointer-events-none"
          />
        </div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
        >
          Payment Successful!
        </motion.h2>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-gray-500 dark:text-gray-400 mb-8 flex flex-col space-y-2"
        >
          <p>Thank you. Enjoy your meal.</p>
          <p className="text-sm">Your receipt has been sent to your email — please check your inbox.</p>
        </motion.div>
        
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={onComplete}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg shadow-green-500/30"
        >
          Done
        </motion.button>
      </motion.div>
    </div>
  );
}
