"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import type {
  UpdateEmployeeCommand,
  Employee,
  ListEmployeesResult,
  EmployeeClassification,
} from "@/lib/types";
import { toast } from "sonner";

type FormErrors = Partial<
  Record<
    "firstName" | "lastName" | "email" | "baseHourlyRate" | "general",
    string
  >
>;

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState<string>("0");
  const [baseHourlyRate, setBaseHourlyRate] = useState("0");
  const [hireDate, setHireDate] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  // Supervisor options
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    async function loadData() {
      try {
        // Load employee data
        const employee = await api<Employee>(`/api/employees/${resolvedParams.id}`);
        
        setEmployeeNumber(employee.employeeNumber);
        setFirstName(employee.firstName);
        setLastName(employee.lastName);
        setEmail(employee.email || "");
        setPhone(employee.phone || "");
        setTitle(employee.title || "");
        setClassification(employee.classification.toString());
        setBaseHourlyRate(employee.baseHourlyRate.toString());
        setHireDate(employee.hireDate ? employee.hireDate.split("T")[0] : "");
        setTerminationDate(employee.terminationDate ? employee.terminationDate.split("T")[0] : "");
        setSupervisorId(employee.supervisorId || "");
        setIsActive(employee.isActive);
        setNotes(""); // Notes not returned in current DTO

        // Load supervisors (exclude current employee)
        const result = await api<ListEmployeesResult>(
          "/api/employees?isActive=true&pageSize=200"
        );
        setSupervisors(result.items.filter(e => e.id !== resolvedParams.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load employee";
        if (message.toLowerCase().includes("not found")) {
          setNotFound(true);
        }
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [resolvedParams.id]);

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!firstName.trim()) {
      next.firstName = "First name is required";
    }
    if (!lastName.trim()) {
      next.lastName = "Last name is required";
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Invalid email format";
    }

    const rate = parseFloat(baseHourlyRate);
    if (isNaN(rate) || rate < 0) {
      next.baseHourlyRate = "Rate must be a positive number";
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      setIsSubmitting(false);
      return;
    }

    const command: UpdateEmployeeCommand = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      classification: parseInt(classification) as EmployeeClassification,
      baseHourlyRate: parseFloat(baseHourlyRate) || 0,
      hireDate: hireDate || undefined,
      terminationDate: terminationDate || undefined,
      supervisorId: supervisorId || undefined,
      isActive,
      notes: notes.trim() || undefined,
    };

    try {
      await api<Employee>(`/api/employees/${resolvedParams.id}`, {
        method: "PUT",
        body: command,
      });
      toast.success("Employee updated successfully");
      router.push(`/employees/${resolvedParams.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update employee";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/employees/${resolvedParams.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Employee</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Employees
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Employee not found</h2>
            <p className="text-muted-foreground mt-2">
              The employee you&apos;re trying to edit doesn&apos;t exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/employees/${resolvedParams.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Employee</h1>
          <p className="text-muted-foreground font-mono">{employeeNumber}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
          <CardDescription>
            Update the employee&apos;s information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Number (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">Employee Number</Label>
              <Input
                id="employeeNumber"
                value={employeeNumber}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Employee number cannot be changed
              </p>
            </div>

            {/* Name Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Contact Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Carpenter, Electrician, Project Manager..."
              />
            </div>

            {/* Classification & Rate Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="classification">Classification *</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Hourly</SelectItem>
                    <SelectItem value="1">Salaried</SelectItem>
                    <SelectItem value="2">Contractor</SelectItem>
                    <SelectItem value="3">Apprentice</SelectItem>
                    <SelectItem value="4">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseHourlyRate">Base Hourly Rate ($)</Label>
                <Input
                  id="baseHourlyRate"
                  type="number"
                  value={baseHourlyRate}
                  onChange={(e) => setBaseHourlyRate(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="25.00"
                />
                {errors.baseHourlyRate && (
                  <p className="text-sm text-destructive">{errors.baseHourlyRate}</p>
                )}
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
            </div>

            {/* Supervisor */}
            <div className="space-y-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName} ({s.employeeNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="isActive" className="font-normal">
                Employee is active
              </Label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this employee..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
