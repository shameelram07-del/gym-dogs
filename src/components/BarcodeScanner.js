'use client';

// Camera scanner. Two ways out of it, because barcodes fail often enough that a
// scanner without a fallback is a dead end:
//   1. Barcode  → onDetected(code)
//   2. Label    → onLabel(dataUrl)  — grabs the current frame for the AI to read
//   3. Typing the number in by hand
//
// Chrome on Android has BarcodeDetector natively. Safari, iOS and desktop Chrome
// on Windows do not, so those lazy-load ZXing from a CDN. Important: in the ZXing
// path we must NOT touch the video element ourselves — ZXing calls getUserMedia
// and play() internally, and a second play() aborts its decode loop (that's the
// "Trying to play video that is already playing" warning).

import { useEffect, useRef, useState, useCallback } from 'react';

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.ZXing) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load the scanner')));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the scanner'));
    document.head.appendChild(s);
  });
}

export default function BarcodeScanner({ onDetected, onLabel, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const stopRef = useRef(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Starting camera…');
  const [live, setLive] = useState(false);

  // Grab the current frame at full sensor width — nutrition print is small.
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const maxDim = 1100;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  useEffect(() => {
    stopRef.current = false;
    let rafId = null;

    const finish = (code) => {
      if (stopRef.current || !code) return;
      stopRef.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      onDetected(String(code).replace(/\D/g, ''));
    };

    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('This browser has no camera access. Type the number in instead.');
        }

        // ── Path A: native detector (Chrome/Android) ──
        if ('BarcodeDetector' in window) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
            audio: false,
          });
          streamRef.current = stream;
          if (stopRef.current) return;

          const video = videoRef.current;
          if (!video) return;
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          await video.play();
          setLive(true);
          setStatus('Point at the barcode');

          let supported = FORMATS;
          try {
            const avail = await window.BarcodeDetector.getSupportedFormats();
            const usable = FORMATS.filter((f) => avail.includes(f));
            if (usable.length) supported = usable;
          } catch (e) { /* fall back to our list */ }

          const detector = new window.BarcodeDetector({ formats: supported });
          const scan = async () => {
            if (stopRef.current) return;
            try {
              const hits = await detector.detect(video);
              if (hits && hits.length) return finish(hits[0].rawValue);
            } catch (e) { /* transient frame errors are normal */ }
            rafId = requestAnimationFrame(scan);
          };
          rafId = requestAnimationFrame(scan);
          return;
        }

        // ── Path B: ZXing owns the video element entirely ──
        setStatus('Loading scanner…');
        await loadScript(ZXING_CDN);
        if (stopRef.current) return;
        const ZX = window.ZXing;
        if (!ZX || !ZX.BrowserMultiFormatReader) throw new Error('Scanner unavailable. Type the number in instead.');

        const reader = new ZX.BrowserMultiFormatReader();
        readerRef.current = reader;
        await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } },
          videoRef.current,
          (result) => { if (result) finish(result.getText()); }
        );
        if (stopRef.current) return;
        setLive(true);
        setStatus('Point at the barcode');
      } catch (e) {
        setStatus('');
        setError(
          e && e.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow it in your browser settings, or type the number in.'
            : (e && e.message) || 'Could not start the camera.'
        );
      }
    })();

    return () => {
      stopRef.current = true;
      if (rafId) cancelAnimationFrame(rafId);
      try { if (readerRef.current) readerRef.current.reset(); } catch (e) {}
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  const shootLabel = () => {
    const frame = captureFrame();
    if (!frame) { setError('Camera is not ready yet — give it a second.'); return; }
    stopRef.current = true;
    onLabel(frame);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {!error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '78%', maxWidth: 330, aspectRatio: '5 / 3', border: '2px solid rgba(255,255,255,0.9)', borderRadius: 18, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.42)' }} />
          </div>
        )}

        {status && (
          <p style={{ position: 'absolute', top: 'calc(50% + 118px)', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 600, margin: 0, pointerEvents: 'none' }}>
            {status}
          </p>
        )}

        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 'max(18px, env(safe-area-inset-top))', right: 18, width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 20, cursor: 'pointer',
        }}>×</button>

        {/* The escape hatch, right where the frustration happens */}
        {live && (
          <button onClick={shootLabel} style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            padding: '13px 20px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            📄 Read the label instead
          </button>
        )}
      </div>

      <div style={{ background: 'var(--card)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '18px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        {error && <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--orange-ink)', lineHeight: 1.5 }}>{error}</p>}
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          Or type the number
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="number" inputMode="numeric" placeholder="9300675024235"
            value={manual} onChange={(e) => setManual(e.target.value)}
            style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 14px', color: 'var(--ink)', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            onClick={() => manual.trim() && onDetected(manual.replace(/\D/g, ''))}
            disabled={!manual.trim()}
            style={{
              padding: '13px 20px', borderRadius: 12, border: 'none',
              background: manual.trim() ? 'var(--accent)' : 'var(--soft)',
              color: manual.trim() ? 'var(--on-accent)' : 'var(--ink-3)',
              fontSize: 14, fontWeight: 700, cursor: manual.trim() ? 'pointer' : 'not-allowed',
            }}
          >Find</button>
        </div>
      </div>
    </div>
  );
}
