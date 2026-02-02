"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const bids = [
  {
    id: "1",
    number: "B-2024-010",
    name: "City Hall HVAC Upgrade",
    status: "Submitted",
    value: "$850,000",
    bidDate: "2024-01-10",
    dueDate: "2024-02-15",
  },
  {
    id: "2",
    number: "B-2024-011",
    name: "School District Roof Replacement",
    status: "Draft",
    value: "$1,200,000",
    bidDate: "",
    dueDate: "2024-02-20",
  },
  {
    id: "3",
    number: "B-2024-012",
    name: "Airport Terminal Extension",
    status: "Under Review",
    value: "$15,500,000",
    bidDate: "2024-01-05",
    dueDate: "2024-03-01",
  },
  {
    id: "4",
    number: "B-2024-013",
    name: "Highway 101 Overpass Repair",
    status: "Won",
    value: "$3,200,000",
    bidDate: "2023-12-15",
    dueDate: "2024-01-15",
  },
  {
    id: "5",
    number: "B-2024-014",
    name: "Waterfront Hotel Foundation",
    status: "Lost",
    value: "$6,800,000",
    bidDate: "2023-12-01",
    dueDate: "2024-01-10",
  },
];

function statusColor(status: string) {
  switch (status) {
    case "Submitted":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "Draft":
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case "Under Review":
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "Won":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "Lost":
      return "bg-red-100 text-red-600 hover:bg-red-100";
    default:
      return "";
  }
}

export default function BidsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bids</h1>
          <p className="text-muted-foreground">Track and manage bid proposals</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/bids/new">+ New Bid</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Bids</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Bid Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bids.map((bid) => (
                <TableRow key={bid.id}>
                  <TableCell className="font-mono text-sm">{bid.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/bids/${bid.id}`}
                      className="font-medium text-amber-700 hover:underline"
                    >
                      {bid.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColor(bid.status)}>
                      {bid.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{bid.value}</TableCell>
                  <TableCell className="text-muted-foreground">{bid.bidDate || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{bid.dueDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
