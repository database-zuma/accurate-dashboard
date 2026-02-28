"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { MetisHeader } from "./metis-header";
import { MetisContextBar } from "./metis-context-bar";
import { MetisMessages } from "./metis-messages";
import { MetisInput } from "./metis-input";
import { useMetisContext } from "@/providers/metis-provider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DASHBOARD_ID = "accurate-sales";

interface MetisPanelProps {
  onClose: () => void;
  isVisible: boolean;
}

/** Save session to DB (debounced by caller) */
async function saveSession(id: string, messages: UIMessage[]) {
  try {
    await fetch("/api/metis/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dashboard: DASHBOARD_ID, messages }),
    });
  } catch {
    // silent — persistence is best-effort
  }
}

/** Load latest session from DB */
async function loadSession(): Promise<{
  id: string;
  messages: UIMessage[];
} | null> {
  try {
    const res = await fetch(
      `/api/metis/sessions?dashboard=${DASHBOARD_ID}`
    );
    const { session } = await res.json();
    if (session?.messages?.length > 0) {
      return { id: session.id, messages: session.messages };
    }
  } catch {
    // silent
  }
  return null;
}

export function MetisPanel({ onClose, isVisible }: MetisPanelProps) {
  const { dashboardContext } = useMetisContext();
  const [chatId, setChatId] = useState(() => `metis-${Date.now()}`);
  const contextRef = useRef(dashboardContext);
  contextRef.current = dashboardContext;

  // Track which model actually responded (read from X-Metis-Model response header)
  const [activeModel, setActiveModel] = useState<string>("Kimi K2.5");
  const setActiveModelRef = useRef(setActiveModel);
  setActiveModelRef.current = setActiveModel;

  // DB persistence — whether we've loaded the initial session
  const [loaded, setLoaded] = useState(false);

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

  // ── Load previous session on mount ──
  useEffect(() => {
    loadSession().then((prev) => {
      if (prev) {
        setChatId(prev.id);
        setMessages(prev.messages);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save after each completed exchange ──
  const prevLenRef = useRef(0);
  useEffect(() => {
    if (!loaded) return;
    // Save when message count increases and we're not actively streaming
    if (messages.length > 0 && messages.length !== prevLenRef.current && !isLoading) {
      prevLenRef.current = messages.length;
      saveSession(chatId, messages);
    }
  }, [messages, isLoading, chatId, loaded]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    // Save empty to close old session, start fresh
    saveSession(chatId, []);
    setMessages([]);
    const newId = `metis-${Date.now()}`;
    setChatId(newId);
    prevLenRef.current = 0;
  }, [chatId, setMessages]);

  return (
    <AnimatePresence>
      {isVisible && (
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
      )}
    </AnimatePresence>
  );
}
