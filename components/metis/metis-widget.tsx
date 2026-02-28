"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Portal } from "./portal";
import { MetisBubble } from "./metis-bubble";
import { MetisPanel } from "./metis-panel";
import { MetisNewFeaturePopup } from "./metis-new-feature-popup";

export function MetisWidget() {
  const [isOpen, setIsOpen] = useState(false);
  // Show popup once per page load (useState = resets on fresh load, not on tab switch)
  const [showPopup, setShowPopup] = useState(true);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setShowPopup(false);
  }, []);

  const handleClose = useCallback(() => setIsOpen(false), []);
  const handlePopupClose = useCallback(() => setShowPopup(false), []);

  return (
    <Portal>
      {/* "Fitur Baru" popup — shown on fresh page load only, dismissed when chat opens */}
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

      <AnimatePresence>
        {isOpen && (
          <MetisPanel key="panel" onClose={handleClose} />
        )}
      </AnimatePresence>
    </Portal>
  );
}
