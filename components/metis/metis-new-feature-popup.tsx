"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Zap } from "lucide-react";

interface MetisNewFeaturePopupProps {
  onClose: () => void;
  onTryCTA: () => void;
}

const DISMISS_AFTER_MS = 10000;

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
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="fixed bottom-[96px] right-6 z-[9998] w-80 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #002A3A 0%, #003d4f 100%)",
        border: "1.5px solid rgba(0,226,115,0.35)",
        boxShadow:
          "0 20px 60px -10px rgba(0,42,58,0.5), 0 0 40px -5px rgba(0,226,115,0.15)",
      }}
    >
      {/* Glow accent line at top */}
      <div
        className="h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, #00E273 30%, #00E273 70%, transparent)",
        }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Sparkles className="size-5 text-[#00E273]" />
          </motion.div>
          <span className="text-[11px] font-extrabold text-[#00E273] uppercase tracking-[0.15em]">
            ✨ Fitur Baru!
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Tutup"
        >
          <X className="size-4 text-white/40" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-5 pt-1">
        <p className="text-white font-bold text-base leading-snug">
          Metis 🔮 — AI Data Analyst
        </p>
        <p className="text-white/60 text-[13px] mt-2 leading-relaxed">
          Tanya apa saja tentang data penjualan Zuma langsung dari dashboard ini. Didukung AI, gratis!
        </p>

        {/* Feature chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["📊 Analisis Sales", "🏪 Per Toko", "📈 Trend"].map((chip) => (
            <span
              key={chip}
              className="text-[10px] text-[#00E273]/80 bg-[#00E273]/10 border border-[#00E273]/20 px-2 py-0.5 rounded-full"
            >
              {chip}
            </span>
          ))}
        </div>

        <button
          onClick={() => {
            onClose();
            onTryCTA();
          }}
          className="mt-4 w-full flex items-center justify-center gap-2 text-[13px] font-bold text-[#002A3A] bg-[#00E273] hover:bg-[#00c960] active:scale-[0.97] transition-all rounded-xl py-2.5 shadow-lg shadow-[#00E273]/20"
        >
          <Zap className="size-4" />
          Coba Sekarang
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className="h-[3px]"
        style={{
          background: "linear-gradient(90deg, #00E273, #00E273)",
          transformOrigin: "left",
        }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DISMISS_AFTER_MS / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}
