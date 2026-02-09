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
  MapPin,
  Building,
  Shield,
  CreditCard,
} from "lucide-react";
import api from "@/lib/api";
import type { HREmployeeDto } from "@/lib/hr-types";
import {
  employmentStatusLabels,
  employmentStatusColors,
  workerTypeLabels,
  workerTypeColors,
  flsaStatusLabels,
  employmentTypeLabels,
  payFrequencyLabels,
  payTypeLabels,
  paymentMethodLabels,
  i9StatusLabels,
  I9Status,
} from "@/lib/hr-types";
import { toast } from "sonner";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
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

function formatSSN(last4: string): string {
  return `***-**-${last4}`;
}

function formatAddress(address: HREmployeeDto["address"]): string {
  if (!address) return "—";
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.zipCode].filter(Boolean).join(", "),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : "—";
}

export default function HREmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [employee, setEmployee] = useState<HREmployeeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const emp = await api<HREmployeeDto>(`/api/hr/employees/${resolvedParams.id}`);
        setEmployee(emp);
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
            <Link href="/hr/employees">
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
            <Link href="/hr/employees">
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

  const i9StatusColor =
    employee.i9Status === I9Status.Verified
      ? "bg-green-100 text-green-800"
      : employee.i9Status === I9Status.NotStarted
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/hr/employees">
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
          <Badge variant="secondary" className={employmentStatusColors[employee.status]}>
            {employmentStatusLabels[employee.status]}
          </Badge>
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link href={`/hr/employees/${employee.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">
                    {employee.firstName}
                    {employee.middleName ? ` ${employee.middleName}` : ""}
                    {" "}{employee.lastName}
                    {employee.suffix ? `, ${employee.suffix}` : ""}
                  </p>
                  {employee.preferredName && (
                    <p className="text-sm text-muted-foreground">
                      Goes by &quot;{employee.preferredName}&quot;
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{formatDate(employee.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SSN</p>
                  <p className="font-medium font-mono">{formatSSN(employee.ssnLast4)}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Work Email</p>
                    <p className="font-medium">
                      {employee.email ? (
                        <a href={`mailto:${employee.email}`} className="text-blue-600 hover:underline">
                          {employee.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    {employee.personalEmail && (
                      <>
                        <p className="text-sm text-muted-foreground mt-2">Personal Email</p>
                        <a href={`mailto:${employee.personalEmail}`} className="text-blue-600 hover:underline text-sm">
                          {employee.personalEmail}
                        </a>
                      </>
                    )}
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
                    {employee.secondaryPhone && (
                      <>
                        <p className="text-sm text-muted-foreground mt-2">Secondary</p>
                        <a href={`tel:${employee.secondaryPhone}`} className="text-blue-600 hover:underline text-sm">
                          {employee.secondaryPhone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium whitespace-pre-line">{formatAddress(employee.address)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Employment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary" className={employmentStatusColors[employee.status]}>
                    {employmentStatusLabels[employee.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Worker Type</p>
                  <Badge variant="secondary" className={workerTypeColors[employee.workerType]}>
                    {workerTypeLabels[employee.workerType]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium">{employmentTypeLabels[employee.employmentType]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">FLSA Status</p>
                  <p className="font-medium">{flsaStatusLabels[employee.flsaStatus]}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Job Title</p>
                  <p className="font-medium">{employee.jobTitle || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trade Code</p>
                  <p className="font-medium font-mono">{employee.tradeCode || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Workers&apos; Comp Class</p>
                  <p className="font-medium font-mono">{employee.workersCompClassCode || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Union Member</p>
                  <p className="font-medium">{employee.isUnionMember ? "Yes" : "No"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Employment Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Original Hire Date</p>
                <p className="font-medium">{formatDate(employee.originalHireDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Most Recent Hire</p>
                <p className="font-medium">{formatDate(employee.mostRecentHireDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Termination Date</p>
                <p className="font-medium">{formatDate(employee.terminationDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Eligible for Rehire</p>
                <p className="font-medium">{employee.eligibleForRehire ? "Yes" : "No"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payroll Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payroll Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Pay Frequency</p>
                  <p className="font-medium">{payFrequencyLabels[employee.payFrequency]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Default Pay Type</p>
                  <p className="font-medium">{payTypeLabels[employee.defaultPayType]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Default Hourly Rate</p>
                  <p className="font-medium font-mono">{formatCurrency(employee.defaultHourlyRate)}/hr</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{paymentMethodLabels[employee.paymentMethod]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Home State</p>
                  <p className="font-medium">{employee.homeState || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SUI State</p>
                  <p className="font-medium">{employee.suiState || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compliance Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance
              </CardTitle>
              <CardDescription>Verification and background status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">I-9 Status</p>
                <Badge variant="secondary" className={i9StatusColor}>
                  {i9StatusLabels[employee.i9Status]}
                </Badge>
              </div>
              {employee.eVerifyStatus != null && (
                <div>
                  <p className="text-sm text-muted-foreground">E-Verify</p>
                  <p className="font-medium">
                    {employee.eVerifyStatus === 2 ? "Authorized" : "Pending/Other"}
                  </p>
                </div>
              )}
              {employee.backgroundCheckStatus != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Background Check</p>
                  <p className="font-medium">
                    {employee.backgroundCheckStatus === 3
                      ? "Cleared"
                      : employee.backgroundCheckStatus === 0
                      ? "Not Required"
                      : "Pending"}
                  </p>
                </div>
              )}
              {employee.drugTestStatus != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Drug Test</p>
                  <p className="font-medium">
                    {employee.drugTestStatus === 3
                      ? "Passed"
                      : employee.drugTestStatus === 0
                      ? "Not Required"
                      : "Pending"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Record Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Record Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-mono text-xs break-all">{employee.id}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(employee.createdAt)}</p>
              </div>
              {employee.updatedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatDate(employee.updatedAt)}</p>
                </div>
              )}
              {employee.appUserId && (
                <div>
                  <p className="text-sm text-muted-foreground">Linked App User</p>
                  <p className="font-mono text-xs break-all">{employee.appUserId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {employee.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{employee.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
