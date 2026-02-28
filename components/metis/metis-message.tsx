"use client";

import { type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Loader2, Database } from "lucide-react";

interface MetisMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function MetisMessage({ message, isStreaming }: MetisMessageProps) {
  const isUser = message.role === "user";

  // During streaming: show tool calls but buffer text → reveal all at once when done
  const showBuffered = !isUser && isStreaming;

  // Determine thinking phase from tool-invocation state
  const hasActiveToolCall = message.parts.some(
    (p) =>
      p.type === "tool-invocation" &&
      ["call", "partial-call"].includes(
        (p as unknown as { state: string }).state
      )
  );
  const hasCompletedToolCall = message.parts.some(
    (p) =>
      p.type === "tool-invocation" &&
      (p as unknown as { state: string }).state === "result"
  );

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`shrink-0 size-7 rounded-full flex items-center justify-center ${
          isUser ? "bg-[#002A3A] text-white" : "bg-[#00E273]/15 text-[#002A3A]"
        }`}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[#002A3A] text-white rounded-tr-md"
            : "bg-muted rounded-tl-md"
        }`}
      >
        {message.parts.map((part, i) => {
          // Text parts: buffer during streaming, show when done
          if (part.type === "text") {
            if (showBuffered) return null; // Hide text while streaming
            return (
              <div key={i} className="metis-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-1.5 last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-1.5 space-y-0.5">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-1.5 space-y-0.5">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <pre className="bg-black/5 rounded-md p-2 my-1.5 overflow-x-auto text-xs">
                            <code>{children}</code>
                          </pre>
                        );
                      }
                      return (
                        <code className="bg-black/5 rounded px-1 py-0.5 text-xs font-mono">
                          {children}
                        </code>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-1.5">
                        <table className="min-w-full text-xs border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-black/5">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-2 py-1 text-left font-semibold border-b border-border">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-2 py-1 border-b border-border/50">
                        {children}
                      </td>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-semibold text-sm mt-2 mb-1">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="font-semibold text-xs mt-1.5 mb-0.5">
                        {children}
                      </h4>
                    ),
                  }}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }

          // Tool invocations: always show (useful progress feedback)
          if (part.type === "tool-invocation") {
            const toolInv = part as unknown as {
              toolInvocationId: string;
              toolName: string;
              state: string;
              args?: Record<string, unknown>;
              result?: Record<string, unknown>;
            };
            if (
              toolInv.state === "call" ||
              toolInv.state === "partial-call"
            ) {
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground py-1"
                >
                  <Loader2 className="size-3 animate-spin" />
                  <span>Querying database...</span>
                </div>
              );
            }
            if (toolInv.state === "result" && toolInv.result) {
              const r = toolInv.result as {
                success?: boolean;
                purpose?: string;
                rowCount?: number;
              };
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5"
                >
                  <Database className="size-3" />
                  <span>
                    {r.success
                      ? `✓ ${r.purpose} (${r.rowCount} rows)`
                      : `✗ Query failed`}
                  </span>
                </div>
              );
            }
          }
          return null;
        })}

        {/* Thinking indicator: shown during streaming, context-aware label */}
        {showBuffered && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
            <Loader2 className="size-3 animate-spin" />
            <span>
              {hasActiveToolCall
                ? "Querying database..."
                : hasCompletedToolCall
                  ? "Menyusun jawaban..."
                  : "Menganalisis..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
