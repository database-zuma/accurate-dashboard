"use client";

import { useRef, useEffect } from "react";
import { type UIMessage } from "ai";
import { MetisMessage } from "./metis-message";
import { Sparkles } from "lucide-react";

interface MetisMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
}

export function MetisMessages({ messages, isLoading }: MetisMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center gap-3">
        <div className="size-12 rounded-full bg-[#00E273]/10 flex items-center justify-center">
          <Sparkles className="size-6 text-[#00E273]" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">Halo! Saya Metis 🔮</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
            AI analyst untuk dashboard ini. Tanya apa saja tentang data penjualan Zuma.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 w-full mt-2">
          {[
            "Top 5 artikel paling laku bulan ini?",
            "Revenue trend per branch",
            "Performa series mana yang naik?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="text-[11px] text-left px-3 py-2 rounded-lg border border-border
                         hover:bg-muted/50 hover:border-[#00E273]/30 transition-colors
                         text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Dispatch custom event to fill input
                window.dispatchEvent(
                  new CustomEvent("metis:fill-input", { detail: suggestion })
                );
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((message, idx) => {
        const isLastAssistant =
          idx === messages.length - 1 && message.role === "assistant";
        return (
          <MetisMessage
            key={message.id}
            message={message}
            isStreaming={isLoading && isLastAssistant}
          />
        );
      })}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex gap-2">
          <div className="size-7 rounded-full bg-[#00E273]/15 flex items-center justify-center shrink-0">
            <Sparkles className="size-3.5 text-[#002A3A] animate-pulse" />
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-md px-3 py-2">
            <div className="flex gap-1">
              <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
