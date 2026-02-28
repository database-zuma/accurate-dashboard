"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { MetisHeader } from "./metis-header";
import { MetisContextBar } from "./metis-context-bar";
import { MetisMessages } from "./metis-messages";
import { MetisInput } from "./metis-input";
import { MetisSessionList, type SessionMeta } from "./metis-session-list";
import { useMetisContext } from "@/providers/metis-provider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DASHBOARD_ID = "accurate-sales";

// ── User fingerprint ──────────────────────────────────
// Simple browser fingerprint — persisted in localStorage so the same browser
// always gets the same ID. No login needed.
function getUserFingerprint(): string {
  const KEY = "metis-uid";
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    uid = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(KEY, uid);
  }
  return uid;
}

interface MetisPanelProps {
  onClose: () => void;
  isVisible: boolean;
}

// ── API helpers ───────────────────────────────────────

async function fetchSessions(uid: string): Promise<SessionMeta[]> {
  try {
    const res = await fetch(
      `/api/metis/sessions?dashboard=${DASHBOARD_ID}&uid=${uid}`
    );
    const { sessions } = await res.json();
    return sessions || [];
  } catch {
    return [];
  }
}

async function saveSession(
  id: string,
  messages: UIMessage[],
  uid: string,
  title?: string
) {
  try {
    await fetch("/api/metis/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        dashboard: DASHBOARD_ID,
        messages,
        title: title || "",
        uid,
      }),
    });
  } catch {
    // silent
  }
}

async function renameSession(id: string, title: string) {
  try {
    await fetch("/api/metis/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
  } catch {
    // silent
  }
}

async function deleteSession(id: string) {
  try {
    await fetch("/api/metis/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    // silent
  }
}

// ══════════════════════════════════════════════════════
// MetisPanel — Outer: loads session list, manages active session
// ══════════════════════════════════════════════════════

export function MetisPanel({ onClose, isVisible }: MetisPanelProps) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState("");
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeMessages, setActiveMessages] = useState<UIMessage[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  // Key to force-remount inner component when switching sessions
  const [innerKey, setInnerKey] = useState(0);

  // Init: get uid + load sessions + start new chat
  useEffect(() => {
    const u = getUserFingerprint();
    setUid(u);
    fetchSessions(u).then((list) => {
      setSessions(list);
      // Always start a NEW chat on page load
      const newId = `metis-${Date.now()}`;
      setActiveChatId(newId);
      setActiveMessages([]);
      setReady(true);
    });
  }, []);

  // Switch to existing session
  const handleSelectSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setActiveChatId(session.id);
        setActiveMessages(session.messages as UIMessage[]);
        setInnerKey((k) => k + 1);
        setShowSessions(false);
      }
    },
    [sessions]
  );

  // New chat
  const handleNewChat = useCallback(() => {
    const newId = `metis-${Date.now()}`;
    setActiveChatId(newId);
    setActiveMessages([]);
    setInnerKey((k) => k + 1);
    setShowSessions(false);
  }, []);

  // Rename
  const handleRename = useCallback(
    (id: string, title: string) => {
      renameSession(id, title);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title } : s))
      );
    },
    []
  );

  // Delete
  const handleDelete = useCallback(
    (id: string) => {
      deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // If deleted the active session, start new
      if (id === activeChatId) {
        handleNewChat();
      }
    },
    [activeChatId, handleNewChat]
  );

  // Callback from inner when messages update — sync to session list
  const handleMessagesUpdate = useCallback(
    (id: string, messages: UIMessage[]) => {
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === id);
        if (exists) {
          return prev.map((s) =>
            s.id === id
              ? { ...s, messages, updated_at: new Date().toISOString() }
              : s
          );
        }
        // New session — prepend
        const firstUserMsg = messages.find((m) => m.role === "user");
        const firstPart = firstUserMsg?.parts?.[0];
        const title = (firstPart && "text" in firstPart ? firstPart.text?.slice(0, 60) : null) || "Untitled";
        return [
          {
            id,
            title,
            messages,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as SessionMeta,
          ...prev,
        ];
      });
    },
    []
  );

  if (!ready) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed z-[9999] inset-0 rounded-none
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
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ transformOrigin: "bottom right" }}
          className="fixed z-[9999] inset-0 rounded-none
                     md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[620px] md:max-h-[85vh] md:rounded-2xl
                     shadow-2xl border border-border bg-background
                     flex flex-col overflow-hidden"
        >
          <MetisHeader
            onMinimize={onClose}
            onNewChat={handleNewChat}
            onToggleSessions={() => setShowSessions((v) => !v)}
            showingSessions={showSessions}
            activeModel={undefined} // will be set by inner
          />

          {showSessions ? (
            <MetisSessionList
              sessions={sessions}
              activeSessionId={activeChatId}
              onSelect={handleSelectSession}
              onNew={handleNewChat}
              onRename={handleRename}
              onDelete={handleDelete}
              onClose={() => setShowSessions(false)}
            />
          ) : (
            <MetisPanelInner
              key={`${activeChatId}-${innerKey}`}
              onClose={onClose}
              isVisible={true}
              initialChatId={activeChatId}
              initialMessages={activeMessages}
              uid={uid}
              onMessagesUpdate={handleMessagesUpdate}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// MetisPanelInner — useChat hook + auto-save
// ══════════════════════════════════════════════════════

function MetisPanelInner({
  initialChatId,
  initialMessages,
  uid,
  onMessagesUpdate,
}: {
  onClose: () => void;
  isVisible: boolean;
  initialChatId: string;
  initialMessages: UIMessage[];
  uid: string;
  onMessagesUpdate: (id: string, messages: UIMessage[]) => void;
}) {
  const { dashboardContext } = useMetisContext();
  const contextRef = useRef(dashboardContext);
  contextRef.current = dashboardContext;

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
            body: { messages, dashboardContext: contextRef.current },
          };
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: initialChatId,
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Restore initial messages once
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current && initialMessages.length > 0) {
      restoredRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // Auto-save after each completed exchange
  const prevLenRef = useRef(initialMessages.length);
  useEffect(() => {
    if (
      messages.length > 0 &&
      messages.length !== prevLenRef.current &&
      !isLoading
    ) {
      prevLenRef.current = messages.length;
      saveSession(initialChatId, messages, uid);
      onMessagesUpdate(initialChatId, messages);
    }
  }, [messages, isLoading, initialChatId, uid, onMessagesUpdate]);

  const handleSend = useCallback(
    (text: string) => sendMessage({ text }),
    [sendMessage]
  );

  return (
    <>
      <MetisContextBar
        filters={dashboardContext?.filters}
        activeTab={dashboardContext?.activeTab}
      />
      <MetisMessages messages={messages} isLoading={isLoading} />
      <MetisInput onSend={handleSend} onStop={stop} isLoading={isLoading} />
    </>
  );
}
