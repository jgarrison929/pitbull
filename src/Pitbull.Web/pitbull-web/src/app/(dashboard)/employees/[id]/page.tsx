"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  Pencil,
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  DollarSign,
  Clock,
  FolderOpen,
} from "lucide-react";
import api from "@/lib/api";
import type { Employee, TimeEntry, ProjectAssignment, ListTimeEntriesResult } from "@/lib/types";
import { toast } from "sonner";

const classificationLabels: Record<number, string> = {
  0: "Hourly",
  1: "Salaried",
  2: "Contractor",
  3: "Apprentice",
  4: "Supervisor",
};

const classificationBadgeClass: Record<number, string> = {
  0: "bg-blue-100 text-blue-800",
  1: "bg-purple-100 text-purple-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-green-100 text-green-800",
  4: "bg-amber-100 text-amber-800",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch employee details
        const emp = await api<Employee>(`/api/employees/${resolvedParams.id}`);
        setEmployee(emp);

        // Fetch project assignments
        try {
          const assignData = await api<ProjectAssignment[]>(
            `/api/employees/${resolvedParams.id}/projects`
          );
          setAssignments(assignData);
        } catch {
          // Assignments endpoint might not exist yet
          setAssignments([]);
        }

        // Fetch recent time entries
        try {
          const timeData = await api<ListTimeEntriesResult>(
            `/api/time-entries?employeeId=${resolvedParams.id}&pageSize=10`
          );
          setTimeEntries(timeData.items);
        } catch {
          // Time entries endpoint might fail
          setTimeEntries([]);
        }
      } catch {
        setError("Failed to load employee");
        toast.error("Failed to load employee");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-full bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={User}
              title="Employee not found"
              description={error || "The employee you're looking for doesn't exist or has been removed."}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{employee.fullName}</h1>
            <p className="text-muted-foreground font-mono">{employee.employeeNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={employee.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
          >
            {employee.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link href={`/employees/${employee.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Role */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Title</p>
                    <p className="font-medium">{employee.title || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Classification</p>
                    <Badge
                      variant="secondary"
                      className={classificationBadgeClass[employee.classification] || ""}
                    >
                      {classificationLabels[employee.classification] || "Unknown"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Base Hourly Rate</p>
                    <p className="font-medium font-mono">{formatCurrency(employee.baseHourlyRate)}/hr</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">
                      {employee.email ? (
                        <a href={`mailto:${employee.email}`} className="text-blue-600 hover:underline">
                          {employee.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">
                      {employee.phone ? (
                        <a href={`tel:${employee.phone}`} className="text-blue-600 hover:underline">
                          {employee.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Supervisor</p>
                    <p className="font-medium">{employee.supervisorName || "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Employment Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Hire Date</p>
                <p className="font-medium">{formatDate(employee.hireDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Termination Date</p>
                <p className="font-medium">{formatDate(employee.terminationDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Record Created</p>
                <p className="font-medium">{formatDate(employee.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Time Entries
              </CardTitle>
              <CardDescription>Last 10 time entries for this employee</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No time entries"
                  description="No time entries have been recorded for this employee."
                />
              ) : (
                <div className="space-y-3">
                  {timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{entry.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(entry.date)} • {entry.costCodeDescription}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium font-mono">{entry.totalHours}h</p>
                        <Badge
                          variant="secondary"
                          className={
                            entry.status === 0
                              ? "bg-yellow-100 text-yellow-800"
                              : entry.status === 1
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {entry.status === 0 ? "Pending" : entry.status === 1 ? "Approved" : "Rejected"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Project Assignments
              </CardTitle>
              <CardDescription>Active project assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No assignments"
                  description="This employee is not assigned to any projects."
                />
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-3 border rounded-lg space-y-1"
                    >
                      <p className="font-medium">{assignment.projectName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {assignment.projectNumber}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{assignment.role}</Badge>
                        {assignment.isActive && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Projects Assigned</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Recent Hours (Last 10 Entries)</p>
                <p className="text-2xl font-bold">
                  {timeEntries.reduce((sum, e) => sum + e.totalHours, 0).toFixed(1)}h
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
