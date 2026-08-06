'use client';

// Camera barcode scanner.
//
// Uses the native BarcodeDetector API where it exists (Chrome/Android — instant,
// no download). Safari and iOS don't ship it, so we lazy-load ZXing from a CDN
// only on those devices rather than making every user pay for the library.
//
// Always offers a "type it in" escape hatch: gym lighting is bad, some packets
// are crinkled, and a scanner with no manual fallback is a dead end.

import { useEffect, useRef, useState } from 'react';

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the scanner library'));
    document.head.appendChild(s);
  });
}

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopRef = useRef(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    stopRef.current = false;
    let zxingReader = null;
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

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (stopRef.current) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); // iOS refuses to inline without this
        await video.play();
        setStarting(false);

        if ('BarcodeDetector' in window) {
          let supported = FORMATS;
          try {
            const avail = await window.BarcodeDetector.getSupportedFormats();
            supported = FORMATS.filter((f) => avail.includes(f));
          } catch (e) { /* use our list */ }

          const detector = new window.BarcodeDetector({ formats: supported.length ? supported : FORMATS });
          const scan = async () => {
            if (stopRef.current) return;
            try {
              const hits = await detector.detect(video);
              if (hits && hits.length) return finish(hits[0].rawValue);
            } catch (e) { /* transient frame errors are normal */ }
            rafId = requestAnimationFrame(scan);
          };
          rafId = requestAnimationFrame(scan);
        } else {
          // Safari / iOS path
          await loadScript(ZXING_CDN);
          if (stopRef.current) return;
          const ZX = window.ZXing;
          if (!ZX) throw new Error('Scanner library unavailable. Type the number in instead.');
          zxingReader = new ZX.BrowserMultiFormatReader();
          zxingReader.decodeFromVideoElement(video, (result) => {
            if (result) finish(result.getText());
          });
        }
      } catch (e) {
        setStarting(false);
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
      try { if (zxingReader) zxingReader.reset(); } catch (e) {}
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Reticle */}
        {!error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '76%', maxWidth: 320, aspectRatio: '5 / 3', border: '2px solid rgba(255,255,255,0.9)', borderRadius: 18, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)' }} />
          </div>
        )}

        <p style={{ position: 'absolute', top: 'calc(50% + 120px)', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, margin: 0, pointerEvents: 'none' }}>
          {starting ? 'Starting camera…' : error ? '' : 'Point at the barcode'}
        </p>

        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 'max(18px, env(safe-area-inset-top))', right: 18, width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 20, cursor: 'pointer',
        }}>×</button>
      </div>

      {/* Manual fallback — always available, not just on error */}
      <div style={{ background: 'var(--card)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '18px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        {error && <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--orange-ink)', lineHeight: 1.5 }}>{error}</p>}
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          Or type the number
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="number" inputMode="numeric" placeholder="9300675024235"
            value={manual} onChange={(e) => setManual(e.target.value)}
            style={{
              flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12,
              padding: '13px 14px', color: 'var(--ink)', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => manual.trim() && onDetected(manual.replace(/\D/g, ''))}
            disabled={!manual.trim()}
            style={{
              padding: '13px 20px', borderRadius: 12, border: 'none', background: manual.trim() ? 'var(--accent)' : 'var(--soft)',
              color: manual.trim() ? 'var(--on-accent)' : 'var(--ink-3)', fontSize: 14, fontWeight: 700,
              cursor: manual.trim() ? 'pointer' : 'not-allowed',
            }}
          >Find</button>
        </div>
      </div>
    </div>
  );
}
