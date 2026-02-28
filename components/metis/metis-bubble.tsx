"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MetisBubbleProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function MetisBubble({ onClick, hasUnread }: MetisBubbleProps) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[9999] size-14 rounded-full
                 bg-[#002A3A] text-white shadow-lg shadow-[#002A3A]/25
                 flex items-center justify-center
                 hover:shadow-xl hover:shadow-[#002A3A]/30
                 transition-shadow cursor-pointer"
      aria-label="Open Metis AI Chat"
    >
      <Sparkles className="size-6" />
      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-[#00E273] border-2 border-white" />
      )}
    </motion.button>
  );
}
