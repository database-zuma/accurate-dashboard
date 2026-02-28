"use client";

import { Plus, MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export interface SessionMeta {
  id: string;
  title: string;
  messages: unknown[];
  created_at: string;
  updated_at: string;
}

interface MetisSessionListProps {
  sessions: SessionMeta[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}h lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function MetisSessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
}: MetisSessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (s: SessionMeta) => {
    setEditingId(s.id);
    setEditValue(s.title || "Untitled");
  };

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Chat Sessions
        </span>
        <div className="flex gap-1">
          <button
            onClick={onNew}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="New chat"
          >
            <Plus className="size-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Belum ada session
          </p>
        )}
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          const msgCount = s.messages?.length || 0;
          const displayTitle = s.title || "Untitled chat";

          return (
            <div
              key={s.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
                ${isActive ? "bg-[#00E273]/10 border-r-2 border-[#00E273]" : "hover:bg-muted/50"}`}
              onClick={() => { if (!editingId) onSelect(s.id); }}
            >
              <MessageSquare
                className={`size-3.5 shrink-0 ${isActive ? "text-[#00E273]" : "text-muted-foreground"}`}
              />
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="text-xs bg-background border border-border rounded px-1.5 py-0.5 w-full outline-none focus:border-[#00E273]"
                      maxLength={120}
                    />
                    <button onClick={confirmRename} className="p-0.5 hover:text-[#00E273]">
                      <Check className="size-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={`text-xs truncate ${isActive ? "font-medium text-foreground" : "text-foreground/80"}`}>
                      {displayTitle}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {msgCount} msg · {timeAgo(s.updated_at)}
                    </p>
                  </>
                )}
              </div>

              {/* Actions (visible on hover) */}
              {editingId !== s.id && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(s); }}
                    className="p-1 rounded hover:bg-muted"
                    title="Rename"
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Hapus session ini?")) onDelete(s.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/10"
                    title="Delete"
                  >
                    <Trash2 className="size-3 text-destructive/60" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
