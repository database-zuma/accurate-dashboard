"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion } from "framer-motion";
import { MetisHeader } from "./metis-header";
import { MetisContextBar } from "./metis-context-bar";
import { MetisMessages } from "./metis-messages";
import { MetisInput } from "./metis-input";
import { useMetisContext } from "@/providers/metis-provider";
import { useCallback, useMemo, useRef, useState } from "react";

interface MetisPanelProps {
  onClose: () => void;
}

export function MetisPanel({ onClose }: MetisPanelProps) {
  const { dashboardContext } = useMetisContext();
  const [chatId, setChatId] = useState(() => `metis-${Date.now()}`);
  const contextRef = useRef(dashboardContext);
  contextRef.current = dashboardContext;

  // Track which model actually responded (read from X-Metis-Model response header)
  const [activeModel, setActiveModel] = useState<string>("Kimi K2.5");
  const setActiveModelRef = useRef(setActiveModel);
  setActiveModelRef.current = setActiveModel;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/metis/chat",
        // Custom fetch to capture which model the backend used
        fetch: async (url, options) => {
          const res = await fetch(url, options as RequestInit);
          const model = res.headers.get("X-Metis-Model");
          if (model) setActiveModelRef.current(model);
          return res;
        },
        prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              messages,
              dashboardContext: contextRef.current,
            },
          };
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatId,
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setChatId(`metis-${Date.now()}`);
  }, [setMessages]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 20 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ transformOrigin: "bottom right" }}
      className="fixed z-[9999]
                 inset-0 rounded-none
                 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[620px] md:max-h-[85vh] md:rounded-2xl
                 shadow-2xl border border-border bg-background
                 flex flex-col overflow-hidden"
    >
      <MetisHeader
        onMinimize={onClose}
        onClear={handleClear}
        messageCount={messages.length}
        activeModel={activeModel}
      />
      <MetisContextBar
        filters={dashboardContext?.filters}
        activeTab={dashboardContext?.activeTab}
      />
      <MetisMessages messages={messages} isLoading={isLoading} />
      <MetisInput onSend={handleSend} onStop={stop} isLoading={isLoading} />
    </motion.div>
  );
}
