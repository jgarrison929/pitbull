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

const projects = [
  {
    id: "1",
    number: "P-2024-001",
    name: "Downtown Office Complex",
    status: "Active",
    budget: "$4,500,000",
    pm: "Sarah Johnson",
    updated: "2024-01-15",
  },
  {
    id: "2",
    number: "P-2024-002",
    name: "Riverside Apartments",
    status: "Active",
    budget: "$8,200,000",
    pm: "Mike Chen",
    updated: "2024-01-14",
  },
  {
    id: "3",
    number: "P-2024-003",
    name: "Harbor Bridge Repair",
    status: "On Hold",
    budget: "$1,750,000",
    pm: "Lisa Park",
    updated: "2024-01-12",
  },
  {
    id: "4",
    number: "P-2024-004",
    name: "Community Center Renovation",
    status: "Planning",
    budget: "$2,100,000",
    pm: "James Wilson",
    updated: "2024-01-10",
  },
  {
    id: "5",
    number: "P-2024-005",
    name: "Industrial Warehouse Build",
    status: "Completed",
    budget: "$3,400,000",
    pm: "Sarah Johnson",
    updated: "2024-01-08",
  },
];

function statusColor(status: string) {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "On Hold":
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "Planning":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "Completed":
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    default:
      return "";
  }
}

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your construction projects</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/projects/new">+ New Project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead>Project Manager</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-mono text-sm">{project.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-amber-700 hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{project.budget}</TableCell>
                  <TableCell>{project.pm}</TableCell>
                  <TableCell className="text-muted-foreground">{project.updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
