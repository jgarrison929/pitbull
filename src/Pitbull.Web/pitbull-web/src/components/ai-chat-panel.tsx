"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  RotateCcw,
  MapPin,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { AiChatMessage, AiChatResponse } from "@/lib/types";

interface ChatMessage extends AiChatMessage {
  id: string;
  timestamp: Date;
  errorCode?: string;
  msgType?: "divider" | "error";
}

// ── Context Detection ────────────────────────────────────────────────

function getContextLabel(pathname: string): string | null {
  if (pathname.match(/^\/projects\/[^/]+\/job-cost/)) return "Job Cost";
  if (pathname.match(/^\/projects\/[^/]+\/rfis/)) return "Project RFIs";
  if (pathname.match(/^\/projects\/[^/]+\/submittals/)) return "Submittals";
  if (pathname.match(/^\/projects\/[^/]+\/daily-reports/)) return "Daily Reports";
  if (pathname.match(/^\/projects\/[^/]+\/schedule/)) return "Schedule";
  if (pathname.match(/^\/projects\/[^/]+\/documents/)) return "Documents";
  if (pathname.match(/^\/projects\/[^/]+/)) return "Project Detail";
  if (pathname === "/projects") return "Projects";
  if (pathname.match(/^\/bids\/[^/]+/)) return "Bid Detail";
  if (pathname === "/bids") return "Bids";
  if (pathname.match(/^\/contracts\/[^/]+/)) return "Contract Detail";
  if (pathname === "/contracts") return "Contracts";
  if (pathname.startsWith("/time-tracking")) return "Time Tracking";
  if (pathname.startsWith("/reports/labor-cost")) return "Labor Cost Report";
  if (pathname.startsWith("/reports/project-profitability")) return "Profitability Report";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.match(/^\/employees\/[^/]+/)) return "Employee Detail";
  if (pathname === "/employees") return "Employees";
  if (pathname.startsWith("/rfis")) return "RFIs";
  if (pathname.startsWith("/equipment")) return "Equipment";
  if (pathname.startsWith("/change-orders")) return "Change Orders";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname === "/") return "Dashboard";
  return null;
}

// ── Error Display ────────────────────────────────────────────────────

function getErrorDisplay(errorCode: string, message: string) {
  if (errorCode === "AI_NOT_CONFIGURED") {
    return {
      icon: <Settings className="h-4 w-4" />,
      title: "No AI provider configured",
      body: "Go to Admin \u2192 AI Settings to add an API key.",
      canRetry: false,
    };
  }
  if (errorCode === "AI_PROVIDER_ERROR") {
    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "AI provider error",
      body: message,
      canRetry: true,
    };
  }
  if (errorCode === "NETWORK_ERROR") {
    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Network error",
      body: "Check your connection and try again.",
      canRetry: true,
    };
  }
  return {
    icon: <AlertTriangle className="h-4 w-4" />,
    title: "Something went wrong",
    body: message || "An unexpected error occurred.",
    canRetry: true,
  };
}

// ── Component ────────────────────────────────────────────────────────

export function AiChatPanel() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastContext, setLastContext] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const contextLabel = getContextLabel(pathname);

  // Show divider when context changes (only after first message)
  useEffect(() => {
    if (
      lastContext !== null &&
      contextLabel !== lastContext &&
      messages.length > 0
    ) {
      setMessages((prev) => [
        ...prev,
        {
          id: `div-${Date.now()}`,
          role: "assistant",
          content: `Now viewing: ${contextLabel || "Unknown page"}`,
          timestamp: new Date(),
          msgType: "divider",
        },
      ]);
    }
    setLastContext(contextLabel);
  }, [contextLabel]); // eslint-disable-line react-hooks/exhaustive-deps -- only fire on context change

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (retryText?: string) => {
      const text = (retryText || input).trim();
      if (!text || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      if (!retryText) setInput("");
      setIsLoading(true);

      try {
        const history: AiChatMessage[] = messages
          .filter((m) => !m.msgType && (m.role === "user" || m.role === "assistant"))
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await api<AiChatResponse>("/api/ai/chat", {
          method: "POST",
          body: {
            message: text,
            history: history.length > 0 ? history : undefined,
            systemContext: contextLabel
              ? `User is on the ${contextLabel} page (${pathname})`
              : undefined,
          },
        });

        const reply =
          result && typeof result.reply === "string"
            ? result.reply
            : "Sorry, I received an unexpected response.";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: reply,
            timestamp: new Date(),
          },
        ]);
      } catch (err: unknown) {
        let errorCode = "UNKNOWN";
        let errorMessage = "An unexpected error occurred.";

        if (err instanceof Error) {
          if (
            err.message.includes("fetch") ||
            err.message.includes("network") ||
            err.message.includes("Failed to fetch")
          ) {
            errorCode = "NETWORK_ERROR";
            errorMessage = err.message;
          } else {
            // The api() wrapper throws Error with message from the response body
            try {
              const parsed = JSON.parse(err.message) as {
                error?: string;
                message?: string;
              };
              errorCode = parsed.error || errorCode;
              errorMessage = parsed.message || err.message;
            } catch {
              errorMessage = err.message;
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: errorMessage,
            timestamp: new Date(),
            errorCode,
            msgType: "error",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, contextLabel, pathname]
  );

  const handleRetry = useCallback(
    (errorMsg: ChatMessage) => {
      const idx = messages.findIndex((m) => m.id === errorMsg.id);
      const lastUserMsg = messages
        .slice(0, idx)
        .reverse()
        .find((m) => m.role === "user" && !m.msgType);

      if (lastUserMsg) {
        // Remove both the error and the user message that triggered it, then re-send
        setMessages((prev) =>
          prev.filter((m) => m.id !== errorMsg.id && m.id !== lastUserMsg.id)
        );
        sendMessage(lastUserMsg.content);
      }
    },
    [messages, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all hover:scale-105"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Slide-out panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[600px] w-full max-w-md flex-col rounded-tl-xl border-l border-t bg-background shadow-2xl sm:bottom-4 sm:right-4 sm:rounded-xl sm:border">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Pitbull AI</h3>
                {contextLabel ? (
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    {contextLabel}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Construction assistant
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-8 w-8 p-0"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">How can I help?</p>
                <p className="text-xs mt-1">
                  Ask about projects, bids, contracts, or construction best
                  practices.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // Divider
              if (msg.msgType === "divider") {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center gap-2 text-[10px] text-muted-foreground py-1"
                  >
                    <div className="flex-1 h-px bg-border" />
                    <span>{msg.content}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                );
              }

              // Error
              if (msg.msgType === "error") {
                const display = getErrorDisplay(
                  msg.errorCode || "UNKNOWN",
                  msg.content
                );
                return (
                  <div
                    key={msg.id}
                    className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-1">
                      {display.icon}
                      {display.title}
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                      {display.body}
                    </p>
                    {display.canRetry && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                        onClick={() => handleRetry(msg)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </Button>
                    )}
                  </div>
                );
              }

              // Normal message
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about construction..."
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-auto bg-amber-500 hover:bg-amber-600 px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
