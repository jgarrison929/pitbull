"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface WageDeterminationDto {
  id: string;
  projectId: string;
  determinationNumber: string;
  jurisdictionType: string;
  effectiveDate: string;
  expirationDate?: string | null;
  statusName: string;
}

interface ListResult {
  items: WageDeterminationDto[];
}

export default function WageDeterminationsPage() {
  const [items, setItems] = useState<WageDeterminationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/wage-determinations?page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load wage determinations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wage Determinations</h1>
        <p className="text-muted-foreground">Manage project prevailing wage determinations and effective rates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Determinations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Determination", "Project", "Jurisdiction", "Effective", "Expiration", "Status", "Actions"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Determination</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.determinationNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{item.projectId}</TableCell>
                    <TableCell>{item.jurisdictionType}</TableCell>
                    <TableCell>{item.effectiveDate}</TableCell>
                    <TableCell>{item.expirationDate ?? "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{item.statusName}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/payroll/wage-determinations/${item.id}`}>View</Link>
                      </Button>
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
