"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface WorkClassificationDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  craft?: string | null;
  className?: string | null;
  apprenticeable: boolean;
}

interface ListResult {
  items: WorkClassificationDto[];
}

export default function WorkClassificationsPage() {
  const [items, setItems] = useState<WorkClassificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/classifications?page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load work classifications");
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
        <h1 className="text-2xl font-bold tracking-tight">Work Classifications</h1>
        <p className="text-muted-foreground">Manage craft and class codes used on union wage packages and time entries</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Classifications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Code", "Name", "Craft", "Class", "Apprenticeable", "Status"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Craft</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Apprenticeable</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.craft ?? "-"}</TableCell>
                    <TableCell>{item.className ?? "-"}</TableCell>
                    <TableCell>{item.apprenticeable ? "Yes" : "No"}</TableCell>
                    <TableCell><Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></TableCell>
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
