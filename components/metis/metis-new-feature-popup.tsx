"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Sparkles } from "lucide-react";

interface MetisNewFeaturePopupProps {
  onClose: () => void;
  onTryCTA: () => void;
}

const DISMISS_AFTER_MS = 7000;

export function MetisNewFeaturePopup({
  onClose,
  onTryCTA,
}: MetisNewFeaturePopupProps) {
  // Auto-dismiss after DISMISS_AFTER_MS
  useEffect(() => {
    const t = setTimeout(onClose, DISMISS_AFTER_MS);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 480, damping: 32 }}
      className="fixed bottom-[88px] right-6 z-[9998] w-72 rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: "#002A3A", border: "1px solid rgba(0,226,115,0.25)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[#00E273]" />
          <span className="text-[10px] font-bold text-[#00E273] uppercase tracking-widest">
            Fitur Baru!
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-white/10 transition-colors"
          aria-label="Tutup"
        >
          <X className="size-3.5 text-white/40" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        <p className="text-white font-semibold text-sm leading-snug">
          Metis 🔮 &mdash; AI Data Analyst
        </p>
        <p className="text-white/55 text-[12px] mt-1 leading-relaxed">
          Tanya apa saja tentang data penjualan Zuma langsung dari dashboard ini. Didukung AI, gratis.
        </p>
        <button
          onClick={() => {
            onClose();
            onTryCTA();
          }}
          className="mt-3 w-full text-center text-[12px] font-semibold text-[#002A3A] bg-[#00E273] hover:bg-[#00c960] active:scale-95 transition-all rounded-xl py-2"
        >
          Coba Sekarang →
        </button>
      </div>

      {/* Auto-dismiss progress bar (Framer Motion scaleX for perf) */}
      <motion.div
        className="h-[3px]"
        style={{
          background: "rgba(0,226,115,0.5)",
          transformOrigin: "left",
        }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DISMISS_AFTER_MS / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}
