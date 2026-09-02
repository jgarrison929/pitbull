"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface UnionAgreementDto {
  id: string;
  unionName: string;
  localNumber: string;
  name: string;
  jurisdiction?: string | null;
  state?: string | null;
  effectiveDate: string;
  expirationDate?: string | null;
  statusName: string;
}

interface ListResult {
  items: UnionAgreementDto[];
}

export default function UnionAgreementsPage() {
  const [items, setItems] = useState<UnionAgreementDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/agreements?page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load union agreements");
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
        <h1 className="text-2xl font-bold tracking-tight">Union Agreements</h1>
        <p className="text-muted-foreground">Collective bargaining agreements used to resolve union wage packages</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Union", "Local", "Name", "Jurisdiction", "Effective", "Expiration", "Status"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Union</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.unionName}</TableCell>
                    <TableCell>{item.localNumber}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.jurisdiction ?? item.state ?? "-"}</TableCell>
                    <TableCell>{item.effectiveDate}</TableCell>
                    <TableCell>{item.expirationDate ?? "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{item.statusName}</Badge></TableCell>
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
