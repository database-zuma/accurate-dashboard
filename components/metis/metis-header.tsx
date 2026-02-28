"use client";

import { Sparkles, Minus, Trash2 } from "lucide-react";

interface MetisHeaderProps {
  onMinimize: () => void;
  onClear: () => void;
  messageCount: number;
  activeModel?: string;
}

export function MetisHeader({
  onMinimize,
  onClear,
  messageCount,
  activeModel,
}: MetisHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#002A3A] text-white rounded-t-2xl md:rounded-t-2xl">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#00E273]" />
        <span className="font-semibold text-sm">Metis AI</span>
        <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">beta</span>
        {activeModel && (
          <span
            className="text-[9px] text-[#00E273]/70 bg-[#00E273]/10 border border-[#00E273]/20 px-1.5 py-0.5 rounded font-mono"
            title="Model AI yang sedang aktif"
          >
            {activeModel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {messageCount > 0 && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="size-3.5 text-white/60" />
          </button>
        )}
        <button
          onClick={onMinimize}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus className="size-4 text-white/60" />
        </button>
      </div>
    </div>
  );
}
