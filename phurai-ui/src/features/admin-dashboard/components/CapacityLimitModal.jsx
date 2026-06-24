import React from 'react';
import { Lock } from 'lucide-react';

export default function CapacityLimitModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-gray-100">
          <div className="bg-white px-6 pb-6 pt-8 sm:p-8 sm:pb-6 text-center">
            <div className="mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 mb-6 border-4 border-amber-50">
              <Lock className="h-7 w-7 text-amber-600" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-xl font-bold leading-6 text-gray-900 text-center tracking-tight">
                Space Limit Reached
              </h3>
              <div className="mt-4">
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                  The current floor plan layout is fully occupied. You cannot add more tables to this area. Please contact the System Admin to allocate the budget and expand the physical space configuration.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50/80 px-6 py-4 sm:flex sm:flex-row-reverse sm:px-8 border-t border-gray-100">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors sm:ml-3 sm:w-auto"
              onClick={onClose}
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
