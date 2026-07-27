import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function StatusFilterDropdown({ options = [], value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setActiveValue(value);
  }, [value]);

  const selectedOption = options.find((opt) => opt.value === activeValue) || options[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    setActiveValue(optionValue);
    if (typeof onChange === 'function') {
      onChange(optionValue);
    }
    // Apple micro-delay for tactile feedback animation before closing
    setTimeout(() => {
      setIsOpen(false);
    }, 140);
  };

  return (
    <div className="adm-apple-dropdown" ref={dropdownRef}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`adm-apple-dropdown__trigger ${isOpen ? 'adm-apple-dropdown__trigger--active' : ''}`}
      >
        <motion.span
          key={selectedOption?.value}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {selectedOption?.label || 'Select Status'}
        </motion.span>
        <motion.span
          className="adm-apple-dropdown__chevron"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown size={15} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -10 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 30,
              mass: 0.8,
            }}
            className="adm-apple-dropdown__menu"
          >
            {options.map((opt) => {
              const isSelected = opt.value === activeValue;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileHover={{ x: 4, backgroundColor: 'rgba(200, 169, 110, 0.12)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelect(opt.value)}
                  className={`adm-apple-dropdown__item ${isSelected ? 'adm-apple-dropdown__item--selected' : ''}`}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <motion.span
                      layoutId="activeCheckmark"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="adm-apple-dropdown__check"
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
