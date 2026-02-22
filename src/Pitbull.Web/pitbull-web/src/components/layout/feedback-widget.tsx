"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Bug", "Feature", "Question", "Other"] as const;

const CATEGORY_TO_TYPE: Record<string, string> = {
  Bug: "Bug",
  Feature: "Feature",
  Question: "General",
  Other: "General",
};

export function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("Bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPage = typeof window === "undefined"
    ? ""
    : window.location.pathname + window.location.search;

  async function submit() {
    if (!message.trim()) {
      toast.error("Please enter feedback before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: {
          page: currentPage,
          userRole: user?.roles?.[0] ?? "Unknown",
          category,
          message: message.trim(),
          contactEmail: contactEmail.trim() || null,
          type: CATEGORY_TO_TYPE[category] ?? "General",
          screenshotUrl: screenshotUrl.trim() || null,
          browserInfo: navigator.userAgent,
        },
      });

      setMessage("");
      setContactEmail("");
      setScreenshotUrl("");
      setCategory("Bug");
      setOpen(false);
      toast.success("Thanks, your feedback was submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="fixed bottom-5 right-5 z-50 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="mr-2 h-4 w-4" />
        Feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Share Product Feedback</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="feedback-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">Message</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What happened, what you expected, and how we can improve..."
                rows={6}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/4000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-screenshot">Screenshot URL (optional)</Label>
              <Input
                id="feedback-screenshot"
                type="url"
                value={screenshotUrl}
                onChange={(event) => setScreenshotUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-email">Contact Email (optional)</Label>
              <Input
                id="feedback-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div className="rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
              Page captured: <span className="font-mono">{currentPage || "/"}</span> • Role:{" "}
              <span className="font-medium">{user?.roles?.[0] ?? "Unknown"}</span> • Browser info auto-captured
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={submit} disabled={isSubmitting || !message.trim()}>
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
