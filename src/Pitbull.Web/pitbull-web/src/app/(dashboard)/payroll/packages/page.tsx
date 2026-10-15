"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface WagePackageDto {
  id: string;
  unionAgreementId: string;
  workClassificationId: string;
  scaleCode: string;
  zoneCode?: string | null;
  shiftCode?: string | null;
  effectiveDate: string;
  expirationDate?: string | null;
}

interface ListResult {
  items: WagePackageDto[];
}

export default function WagePackagesPage() {
  const [items, setItems] = useState<WagePackageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/packages?page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load wage packages");
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
        <h1 className="text-2xl font-bold tracking-tight">Wage Packages</h1>
        <p className="text-muted-foreground">Date-effective union wage packages by classification, scale, zone, and shift</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Agreement", "Classification", "Scale", "Zone", "Shift", "Effective", "Expiration"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Scale</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.unionAgreementId}</TableCell>
                    <TableCell className="font-mono text-xs">{item.workClassificationId}</TableCell>
                    <TableCell>{item.scaleCode}</TableCell>
                    <TableCell>{item.zoneCode ?? "-"}</TableCell>
                    <TableCell>{item.shiftCode ?? "-"}</TableCell>
                    <TableCell>{item.effectiveDate}</TableCell>
                    <TableCell>{item.expirationDate ?? "-"}</TableCell>
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
