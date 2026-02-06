"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import api from "@/lib/api";
import type {
  CreateEmployeeCommand,
  Employee,
  ListEmployeesResult,
  EmployeeClassification,
} from "@/lib/types";
import { toast } from "sonner";

function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type FormErrors = Partial<
  Record<
    "employeeNumber" | "firstName" | "lastName" | "email" | "baseHourlyRate" | "general",
    string
  >
>;

export default function NewEmployeePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState<string>("0"); // Hourly default
  const [baseHourlyRate, setBaseHourlyRate] = useState("0");
  const [hireDate, setHireDate] = useState(getTodayISO());
  const [supervisorId, setSupervisorId] = useState("");
  const [notes, setNotes] = useState("");

  // Supervisor options
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    async function loadOptions() {
      try {
        // Load active employees for supervisor dropdown (supervisors are typically classification 4 but allow any)
        const result = await api<ListEmployeesResult>(
          "/api/employees?isActive=true&pageSize=200"
        );
        setSupervisors(result.items);
      } catch {
        toast.error("Failed to load supervisor options");
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
  }, []);

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!employeeNumber.trim()) {
      next.employeeNumber = "Employee number is required";
    }
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

    const command: CreateEmployeeCommand = {
      employeeNumber: employeeNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      classification: parseInt(classification) as EmployeeClassification,
      baseHourlyRate: parseFloat(baseHourlyRate) || 0,
      hireDate: hireDate || undefined,
      supervisorId: supervisorId || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      await api<Employee>("/api/employees", {
        method: "POST",
        body: command,
      });
      toast.success("Employee created successfully");
      router.push("/employees");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create employee";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("already exists")) {
        setErrors({ employeeNumber: "This employee number already exists" });
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Employee</h1>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Employee</h1>
        <p className="text-muted-foreground">
          Add a new employee to your workforce
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
          <CardDescription>
            Enter the employee&apos;s basic information and classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Number */}
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">Employee Number *</Label>
              <Input
                id="employeeNumber"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="E001"
                required
              />
              {errors.employeeNumber && (
                <p className="text-sm text-destructive">{errors.employeeNumber}</p>
              )}
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

            {/* Hire Date & Supervisor Row */}
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
                {isSubmitting ? "Creating..." : "Create Employee"}
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
