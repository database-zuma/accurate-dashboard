"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Portal } from "./portal";
import { MetisBubble } from "./metis-bubble";
import { MetisPanel } from "./metis-panel";

export function MetisWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <Portal>
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
