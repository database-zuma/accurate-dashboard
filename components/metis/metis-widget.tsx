"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Portal } from "./portal";
import { MetisBubble } from "./metis-bubble";
import { MetisPanel } from "./metis-panel";
import { MetisNewFeaturePopup } from "./metis-new-feature-popup";

export function MetisWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setShowPopup(false);
    setHasMounted(true);
  }, []);

  const handleClose = useCallback(() => setIsOpen(false), []);
  const handlePopupClose = useCallback(() => setShowPopup(false), []);

  // Click outside panel → minimize (desktop only, skip on mobile fullscreen)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      // Skip on mobile (panel is fullscreen inset-0, no "outside" to click)
      if (window.innerWidth < 768) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    // Delay listener to avoid the same click that opened the panel from closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <Portal>
      <AnimatePresence>
        {showPopup && !isOpen && (
          <MetisNewFeaturePopup
            key="new-feature-popup"
            onClose={handlePopupClose}
            onTryCTA={handleOpen}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isOpen && (
          <MetisBubble key="bubble" onClick={handleOpen} />
        )}
      </AnimatePresence>

      {hasMounted && (
        <div ref={panelRef}>
          <MetisPanel
            key="panel"
            onClose={handleClose}
            isVisible={isOpen}
          />
        </div>
      )}
    </Portal>
  );
}
