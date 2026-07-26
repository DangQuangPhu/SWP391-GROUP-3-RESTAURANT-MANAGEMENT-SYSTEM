import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatVND } from '@/core/utils/formatCurrency.js';
import OutlineButton from '@/components/common/OutlineButton.jsx';
import '../styles/liquidGlass.css';

export default function AIVisualSearchModal({ isOpen, onClose, menuDishes = [], onPreviewImage }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUrlInput('');
    setTextInput('');
    setIsScanning(false);
    setAiResponse(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (file) => {
    setErrorMessage('');
    setAiResponse(null);

    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Invalid file format. Please upload a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 10MB limit. Please choose a smaller image.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
      runVisualSearch(reader.result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!urlInput || !urlInput.trim()) {
      setErrorMessage('Please enter or paste a valid food image URL.');
      return;
    }
    const cleanUrl = urlInput.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('data:')) {
      setErrorMessage('Image URL must start with http:// or https://');
      return;
    }
    setErrorMessage('');
    setPreviewUrl(cleanUrl);
    runVisualSearch({ imageUrl: cleanUrl });
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput || !textInput.trim()) {
      setErrorMessage('Please describe the food you are craving.');
      return;
    }
    setErrorMessage('');
    runVisualSearch({ textPrompt: textInput.trim() });
  };

  const runVisualSearch = async (payload) => {
    setIsScanning(true);
    setErrorMessage('');

    try {
      let bodyData = {};
      if (typeof payload === 'string') {
        const mimeType = payload.split(';')[0]?.split(':')[1] || 'image/jpeg';
        const base64Data = payload.includes(',') ? payload.split(',')[1] : payload;
        bodyData = { imageBase64: base64Data, mimeType };
      } else if (payload && payload.imageUrl) {
        bodyData = { imageUrl: payload.imageUrl };
      } else if (payload && payload.textPrompt) {
        bodyData = { textPrompt: payload.textPrompt };
      } else if (payload && payload.imageBase64) {
        bodyData = payload;
      }

      bodyData.clientMenuList = menuDishes.map(d => ({
        id: d.id || d.dish_id,
        name: d.name || d.dish_name,
        category: d.category || d.category_name,
        description: d.description,
        price: d.price
      }));

      const res = await fetch('/api/ai/visual-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiResponse(json.data);
      } else {
        throw new Error(json.message || 'AI processing failed');
      }
    } catch (err) {
      console.error('Visual Search Error:', err);
      setErrorMessage(err.message || 'Failed to connect to AI Visual Search. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const getDisplayDishes = () => {
    if (!aiResponse) return [];

    if (aiResponse.isFood && Array.isArray(aiResponse.matchedDishIds) && aiResponse.matchedDishIds.length > 0) {
      const matched = menuDishes.filter(d => {
        const dishIdStr = String(d.id || d.dish_id);
        return aiResponse.matchedDishIds.some(id => String(id) === dishIdStr);
      });
      if (matched.length > 0) return matched;
    }

    return menuDishes.slice(0, 3);
  };

  const handleDishImageClick = (dish) => {
    onPreviewImage?.({
      name: dish.name || dish.dish_name,
      image: dish.image_url || dish.image || '/menu/yellowtail-jalapeno.jpg'
    });
  };

  const displayDishes = getDisplayDishes();

  return (
    <div className="liquid-modal-overlay" onClick={handleClose}>
      <motion.div 
        className="liquid-modal-card"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--menu-text, #342716)', margin: 0, letterSpacing: '-0.01em' }}>
              AI Visual Dish Search
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--menu-body, #4d463d)', margin: '4px 0 0 0' }}>
              Upload any dish photo to discover matching menu recommendations at Phūrai
            </p>
          </div>
          <button 
            type="button" 
            onClick={handleClose}
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#4d463d'
            }}
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="liquid-score-badge liquid-score-badge--amber" style={{ width: '100%', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dropzone or Image Preview Scanning View */}
        {!previewUrl && !isScanning && !aiResponse ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div 
              className="liquid-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <p style={{ fontWeight: '700', color: '#342716', fontSize: '1.05rem', margin: '0 0 6px 0' }}>
                Drag & Drop your food photo here
              </p>
              <p style={{ fontSize: '0.85rem', color: '#6a5e33', margin: 0 }}>
                or click to upload (PNG, JPG, WebP up to 10MB)
              </p>
            </div>

            {/* Divider OR PASTE IMAGE URL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#888', letterSpacing: '0.05em' }}>OR PASTE IMAGE URL</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
            </div>

            {/* Image URL Input Form */}
            <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste food photo URL (https://...)..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.85)',
                  color: '#342716'
                }}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.04, y: -1.5, boxShadow: "0 8px 20px rgba(159,134,85,0.38)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #9f8655, #886d3b)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(159,134,85,0.25)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyze URL
              </motion.button>
            </form>

            {/* Divider OR DESCRIBE YOUR CRAVING */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#888', letterSpacing: '0.05em' }}>OR DESCRIBE YOUR CRAVING</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
            </div>

            {/* Text Input Form */}
            <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g. I want something spicy with noodles..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.85)',
                  color: '#342716'
                }}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.04, y: -1.5, boxShadow: "0 8px 20px rgba(159,134,85,0.38)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #342716, #4d463d)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(52,39,22,0.25)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Ask AI
              </motion.button>
            </form>
          </div>
        ) : (
          <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', maxHeight: '280px', marginBottom: '20px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Uploaded visual dish query" 
                style={{ width: '100%', height: '280px', objectFit: 'cover', opacity: isScanning ? 0.75 : 1, transition: 'opacity 0.3s' }}
              />
            ) : (
              <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '16px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontSize: '1.1rem', fontWeight: '500', opacity: 0.9 }}>"{textInput}"</span>
              </div>
            )}
            
            {/* Lensing Beam Scan Effect */}
            {isScanning && (
              <>
                <div className="liquid-laser-beam" />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(4px)'
                }}>
                  <div className="liquid-score-badge" style={{ background: 'rgba(255,255,255,0.92)', color: '#342716', fontSize: '0.95rem', padding: '10px 20px' }}>
                    {previewUrl ? 'AI Lens Scanning & Analyzing Dish...' : 'AI is reading your craving...'}
                  </div>
                </div>
              </>
            )}

            {!isScanning && (
              <button
                type="button"
                className="apple-liquid-glass-btn"
                onClick={handleReset}
                style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px 16px', fontSize: '0.8rem' }}
              >
                {previewUrl ? 'Change Photo' : 'New Search'}
              </button>
            )}

          </div>
        )}

        {/* AI Results Section */}
        <AnimatePresence>
          {aiResponse && !isScanning && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Message Banner */}
              <div style={{
                background: aiResponse.isFood ? 'rgba(197, 168, 128, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${aiResponse.isFood ? 'rgba(197, 168, 128, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                borderRadius: '16px',
                padding: '14px 18px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#342716' }}>
                    {aiResponse.detectedFoodName 
                      ? `Detected: ${aiResponse.detectedFoodName}`
                      : aiResponse.isFood ? 'Dish Match Result' : 'Non-Food Image Detected'}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#4d463d', lineHeight: '1.4' }}>
                  {aiResponse.message}
                </p>
              </div>

              {/* Matched / Recommended Dish Cards */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#342716', marginBottom: '12px', textTransform: 'uppercase' }}>
                {aiResponse.isFood ? 'Recommended Dishes for You:' : 'Phūrai Top Signature Recommendations:'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayDishes.map((dish) => {
                  const dishIdStr = String(dish.id || dish.dish_id);
                  const score = aiResponse.matchScores ? aiResponse.matchScores[dishIdStr] || 92 : 95;
                  const reason = aiResponse.reasons ? aiResponse.reasons[dishIdStr] : null;

                  return (
                    <motion.div 
                      key={dishIdStr}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => handleDishImageClick(dish)}
                      className="liquid-glass-container"
                      style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '16px', background: '#ffffff', cursor: 'zoom-in' }}
                    >
                      <img 
                        src={dish.image_url || dish.image || '/menu/yellowtail-jalapeno.jpg'} 
                        alt={dish.name || dish.dish_name}
                        style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover' }}
                      />

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '600', color: 'var(--menu-gold, #9b845e)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                            {dish.name || dish.dish_name}
                          </h4>
                          <span className="liquid-score-badge" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            {score}% Match
                          </span>
                        </div>

                        {reason && (
                          <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--menu-body, #4d463d)' }}>
                            {reason}
                          </p>
                        )}
                        <span className="menu-card__price" style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'var(--font-body, "Hanken Grotesk", system-ui, sans-serif)', color: 'var(--menu-text, #342716)' }}>
                          {formatVND(dish.price)}
                        </span>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <OutlineButton onClick={handleClose}>
            Close
          </OutlineButton>
        </div>
      </motion.div>
    </div>
  );
}
