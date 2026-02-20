"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface WageRateDto {
  id: string;
  classificationCode: string;
  classificationName: string;
  baseRate: number;
  fringeRate: number;
  totalRate: number;
}

interface WageDeterminationDto {
  id: string;
  projectId: string;
  determinationNumber: string;
  jurisdictionType: string;
  effectiveDate: string;
  expirationDate?: string | null;
  statusName: string;
  rates: WageRateDto[];
}

export default function WageDeterminationDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<WageDeterminationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItem = useCallback(async () => {
    if (!params.id) return;

    setIsLoading(true);
    try {
      const result = await api<WageDeterminationDto>(`/api/payroll/wage-determinations/${params.id}`);
      setItem(result);
    } catch {
      toast.error("Failed to load wage determination");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  if (isLoading) {
    return <TableSkeleton rows={8} headers={["Classification", "Description", "Base", "Fringe", "Total"]} />;
  }

  if (!item) {
    return <div className="text-sm text-muted-foreground">Wage determination not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{item.determinationNumber}</h1>
        <p className="text-muted-foreground">Project {item.projectId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Jurisdiction</div>
            <div>{item.jurisdictionType}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Effective</div>
            <div>{item.effectiveDate}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Expiration</div>
            <div>{item.expirationDate ?? "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <Badge variant="secondary">{item.statusName}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classification</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Fringe</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>{rate.classificationCode}</TableCell>
                  <TableCell>{rate.classificationName}</TableCell>
                  <TableCell className="text-right">${rate.baseRate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${rate.fringeRate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">${rate.totalRate.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
