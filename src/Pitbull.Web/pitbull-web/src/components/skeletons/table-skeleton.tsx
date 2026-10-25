import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  headers: string[];
  rows?: number;
  title?: string;
}

export function TableSkeleton({ headers, rows = 5, title }: TableSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {title ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="h-5" />
        )}
      </CardHeader>
      <CardContent>
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(rows)].map((_, i) => (
                <TableRow key={i}>
                  {headers.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton 
                        className={`h-4 ${
                          j === 0 ? 'w-20' :        // Number/ID column
                          j === 1 ? 'w-40' :        // Name/Title column  
                          j === 2 ? 'w-16' :        // Status/Badge column
                          j === 3 ? 'w-24' :        // Client/Category column
                          j === 4 ? 'w-20' :        // Value/Amount column
                          'w-24'                     // Date/Other column
                        }`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}