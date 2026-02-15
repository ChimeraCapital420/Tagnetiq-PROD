/* FILE: src/components/DualScanner.css */
/* Scanner styles with fixed header layout */
/* v4.0: Removed align-items/justify-content centering from overlay.
   The refactored DualScanner.tsx no longer has a .dual-scanner-content wrapper.
   Header, viewport, and footer sit directly in the overlay.
   Centering was shrinking the viewport to zero width → black screen. */

/* ============================================ */
/* OVERLAY & CONTAINER                         */
/* ============================================ */

.dual-scanner-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background-color: black;
  display: flex;
  flex-direction: column;
  /* NO align-items: center — children must stretch full width */
  /* NO justify-content: center — children must fill top to bottom */
}

/* .dual-scanner-content is no longer used in the refactored code.
   Kept for backward compatibility in case any other component references it. */
.dual-scanner-content {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: hsl(var(--background));
  overflow: hidden;
}

/* Desktop: constrain size */
@media (min-width: 768px) {
  .dual-scanner-content {
    max-width: 900px;
    max-height: 90vh;
    border-radius: 1rem;
    border: 1px solid hsl(var(--border));
  }
}

/* ============================================ */
/* HEADER - Fixed 3-column layout              */
/* ============================================ */

.dual-scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background-color: hsl(var(--background) / 0.95);
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  backdrop-filter: blur(8px);
  min-height: 56px;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Ensure left/right groups don't squish center */
.dual-scanner-header > div:first-child,
.dual-scanner-header > div:last-child {
  flex-shrink: 0;
}

/* Center section can shrink if needed */
.dual-scanner-header > div:nth-child(2) {
  flex: 1;
  justify-content: center;
  min-width: 0;
}

/* ============================================ */
/* MAIN VIDEO AREA                             */
/* ============================================ */

.dual-scanner-main {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
  background-color: black;
}

.dual-scanner-main video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ============================================ */
/* FOOTER                                      */
/* ============================================ */

.dual-scanner-footer {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: hsl(var(--background) / 0.95);
  border-top: 1px solid hsl(var(--border) / 0.5);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

/* ============================================ */
/* SCANNER CONTROLS ROW                        */
/* ============================================ */

.scanner-controls {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.scanner-controls button {
  width: 2.5rem;
  height: 2.5rem;
}

/* ============================================ */
/* CAPTURE BUTTON                              */
/* ============================================ */

.capture-button {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background-color: transparent;
  border: 4px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  touch-action: manipulation;
}

.capture-button:hover:not(:disabled) {
  transform: scale(1.05);
  border-color: hsl(var(--primary));
}

.capture-button:active:not(:disabled) {
  transform: scale(0.95);
}

.capture-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.capture-button svg {
  width: 3.5rem;
  height: 3.5rem;
}

/* ============================================ */
/* MODE TOGGLE                                 */
/* ============================================ */

.mode-toggle {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background-color: hsl(var(--muted) / 0.5);
  border-radius: 0.5rem;
}

.mode-toggle button {
  flex: 1;
  max-width: 8rem;
  font-size: 0.875rem;
}

/* ============================================ */
/* BARCODE RETICLE                             */
/* ============================================ */

.barcode-reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 300px;
  height: 150px;
  border: 2px solid hsl(var(--primary));
  border-radius: 0.5rem;
  pointer-events: none;
}

.barcode-reticle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsl(var(--primary)) 20%,
    hsl(var(--primary)) 80%,
    transparent 100%
  );
  animation: scan-line 2s ease-in-out infinite;
}

@keyframes scan-line {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

/* ============================================ */
/* GRID OVERLAY                                */
/* ============================================ */

.grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

.grid-overlay > div {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Center crosshair */
.grid-overlay::before,
.grid-overlay::after {
  content: '';
  position: absolute;
  background-color: rgba(255, 255, 255, 0.4);
}

.grid-overlay::before {
  top: 50%;
  left: calc(50% - 10px);
  width: 20px;
  height: 1px;
}

.grid-overlay::after {
  left: 50%;
  top: calc(50% - 10px);
  width: 1px;
  height: 20px;
}

/* ============================================ */
/* RESPONSIVE ADJUSTMENTS                      */
/* ============================================ */

/* Small screens */
@media (max-width: 640px) {
  .dual-scanner-header {
    padding: 0.375rem 0.5rem;
    min-height: 48px;
  }

  .dual-scanner-header button {
    width: 2.25rem;
    height: 2.25rem;
  }

  .dual-scanner-footer {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .capture-button {
    width: 4rem;
    height: 4rem;
  }

  .capture-button svg {
    width: 3rem;
    height: 3rem;
  }

  .mode-toggle button {
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
  }
}

/* Landscape orientation on mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .dual-scanner-content {
    flex-direction: row;
  }

  .dual-scanner-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: hsl(var(--background) / 0.8);
  }

  .dual-scanner-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: hsl(var(--background) / 0.8);
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .dual-scanner-main {
    padding-top: 48px;
    padding-bottom: 80px;
  }
}

/* ============================================ */
/* UTILITY CLASSES                             */
/* ============================================ */

/* Hide on mobile */
@media (max-width: 640px) {
  .hide-mobile {
    display: none !important;
  }
}

/* Touch-friendly buttons */
.dual-scanner-content button,
.dual-scanner-overlay button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}