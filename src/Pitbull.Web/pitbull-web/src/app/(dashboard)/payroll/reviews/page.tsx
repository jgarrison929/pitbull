"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface PayrollReviewDto {
  id: string;
  payrollRunId: string;
  reviewerUserId: string;
  statusName: string;
  comments?: string | null;
  submittedAt?: string | null;
}

interface ListResult {
  items: PayrollReviewDto[];
}

export default function PayrollReviewsPage() {
  const [items, setItems] = useState<PayrollReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/reviews?pendingOnly=true&page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load pending payroll reviews");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function takeAction(id: string, action: "approve" | "reject", comments?: string) {
    try {
      await api(`/api/payroll/reviews/${id}/${action}`, {
        method: "POST",
        body: {
          reviewerUserId: "pm-review",
          comments: comments ?? (action === "approve" ? "Approved" : "Rejected by PM"),
        },
      });
      toast.success(`Review ${action}d`);
      fetchItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} review`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll Reviews</h1>
        <p className="text-muted-foreground">Pending PM review queue for payroll runs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Payroll Run", "Reviewer", "Submitted", "Status", "Comments", "Actions"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll Run</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.payrollRunId}</TableCell>
                    <TableCell>{item.reviewerUserId}</TableCell>
                    <TableCell>{item.submittedAt ?? "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{item.statusName}</Badge></TableCell>
                    <TableCell>{item.comments ?? "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => takeAction(item.id, "approve")}>Approve</Button>
                      <Button variant="outline" size="sm" onClick={() => takeAction(item.id, "reject")}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
