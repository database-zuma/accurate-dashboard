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

/** Save session to DB (best-effort) */
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

/**
 * MetisPanel — Outer wrapper that loads session from DB first,
 * then mounts the inner chat panel with the correct initial state.
 * This avoids the useChat race condition where changing chatId
 * causes the hook to reinitialize with empty messages.
 */
export function MetisPanel({ onClose, isVisible }: MetisPanelProps) {
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [initialChatId, setInitialChatId] = useState<string>("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  // Load session once on mount
  useEffect(() => {
    loadSession().then((prev) => {
      if (prev) {
        setInitialChatId(prev.id);
        setInitialMessages(prev.messages);
      } else {
        setInitialChatId(`metis-${Date.now()}`);
        setInitialMessages([]);
      }
      setSessionLoaded(true);
    });
  }, []);

  if (!sessionLoaded) {
    // Render the shell with a loading indicator while fetching session
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
                       flex flex-col overflow-hidden items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Memuat sesi...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <MetisPanelInner
      key={initialChatId} // Force fresh mount if chatId changes
      onClose={onClose}
      isVisible={isVisible}
      initialChatId={initialChatId}
      initialMessages={initialMessages}
    />
  );
}

/**
 * MetisPanelInner — Contains useChat hook, initialized with correct chatId.
 * Messages are set once via useEffect after mount (no race condition).
 */
function MetisPanelInner({
  onClose,
  isVisible,
  initialChatId,
  initialMessages,
}: MetisPanelProps & {
  initialChatId: string;
  initialMessages: UIMessage[];
}) {
  const { dashboardContext } = useMetisContext();
  const [chatId, setChatId] = useState(initialChatId);
  const contextRef = useRef(dashboardContext);
  contextRef.current = dashboardContext;

  // Track which model actually responded
  const [activeModel, setActiveModel] = useState<string>("Kimi K2.5");
  const setActiveModelRef = useRef(setActiveModel);
  setActiveModelRef.current = setActiveModel;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/metis/chat",
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

  // ── Restore initial messages once on mount ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current && initialMessages.length > 0) {
      restoredRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // ── Auto-save after each completed exchange ──
  const prevLenRef = useRef(initialMessages.length);
  useEffect(() => {
    // Only save when message count actually changes and we're not streaming
    if (messages.length > 0 && messages.length !== prevLenRef.current && !isLoading) {
      prevLenRef.current = messages.length;
      saveSession(chatId, messages);
    }
  }, [messages, isLoading, chatId]);

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
