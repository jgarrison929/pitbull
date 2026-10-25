"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { PendingApproval } from "@/lib/workflows";
import { entityDetailHref } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { TableSkeleton } from "@/components/skeletons";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export default function MyApprovalsPage() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [commentById, setCommentById] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<PendingApproval[]>("/api/workflow-approvals/pending");
      setItems(data);
    } catch {
      toast.error("Failed to load pending approvals");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await api(`/api/workflow-approvals/${id}/approve`, {
        method: "POST",
        body: { comment: commentById[id] || null },
      });
      toast.success("Approved");
      await loadQueue();
    } catch {
      toast.error("Approval failed");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    try {
      await api(`/api/workflow-approvals/${id}/reject`, {
        method: "POST",
        body: { comment: commentById[id] || "Rejected" },
      });
      toast.success("Rejected");
      await loadQueue();
    } catch {
      toast.error("Rejection failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "My Approvals" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Approvals</h1>
        <p className="text-muted-foreground">
          Cross-entity pending approvals — change orders, billing, and more.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending queue</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={4} headers={["Workflow", "Entity", "Step", "Comment", "Actions"]} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="When items need your sign-off, they will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.workflowName}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.createdAtUtc).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.entityType}</Badge>
                        <span>{item.entityTitle ?? item.entityId.slice(0, 8)}</span>
                        <Link
                          href={entityDetailHref(item.entityType, item.entityId)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{item.stepName}</TableCell>
                    <TableCell>
                      <Label htmlFor={`comment-${item.id}`} className="sr-only">
                        Comment
                      </Label>
                      <Input
                        id={`comment-${item.id}`}
                        placeholder="Optional comment"
                        value={commentById[item.id] ?? ""}
                        onChange={(e) =>
                          setCommentById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <LoadingButton
                          size="sm"
                          variant="outline"
                          loading={actingId === item.id}
                          onClick={() => handleReject(item.id)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </LoadingButton>
                        <LoadingButton
                          size="sm"
                          loading={actingId === item.id}
                          onClick={() => handleApprove(item.id)}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </LoadingButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void loadQueue()}>
          Refresh
        </Button>
      </div>
    </div>
  );
}