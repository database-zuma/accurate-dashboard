"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Square } from "lucide-react";

interface MetisInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
}

export function MetisInput({ onSend, onStop, isLoading }: MetisInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Listen for suggestion chip clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail as string;
      setInput(text);
      inputRef.current?.focus();
    };
    window.addEventListener("metis:fill-input", handler);
    return () => window.removeEventListener("metis:fill-input", handler);
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-background">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Tanya tentang data penjualan..."
          rows={1}
          className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm
                     outline-none resize-none placeholder:text-muted-foreground/60
                     focus:border-[#00E273]/50 focus:ring-1 focus:ring-[#00E273]/20
                     disabled:opacity-50 transition-colors"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 size-9 rounded-xl bg-red-500/10 text-red-500
                       flex items-center justify-center hover:bg-red-500/20 transition-colors"
            title="Stop generating"
          >
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 size-9 rounded-xl bg-[#002A3A] text-white
                       flex items-center justify-center
                       hover:bg-[#003a4f] disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors"
            title="Send message"
          >
            <Send className="size-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
