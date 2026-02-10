"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
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
    "employeeNumber" | "firstName" | "lastName" | "email" | "phone" | "baseHourlyRate" | "general",
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
      next.email = "Please enter a valid email address";
    }
    if (phone && !isValidPhoneNumber(phone)) {
      next.phone = "Please enter a valid 10-digit phone number";
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
            <fieldset disabled={isSubmitting} className="space-y-4">
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
                <PhoneInput
                  id="phone"
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  error={errors.phone}
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
                <div className="flex items-center gap-1">
                  <Label htmlFor="classification">Classification <span className="text-destructive">*</span></Label>
                  <SimpleTooltip content="Determines pay structure and overtime eligibility">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="Classification help" />
                  </SimpleTooltip>
                </div>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger id="classification" aria-label="Select employee classification">
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
                  aria-describedby="baseHourlyRate-help"
                />
                {errors.baseHourlyRate ? (
                  <p className="text-sm text-destructive" role="alert">{errors.baseHourlyRate}</p>
                ) : (
                  <p id="baseHourlyRate-help" className="text-xs text-muted-foreground">
                    Used for cost calculations and overtime pay
                  </p>
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
                <Select value={supervisorId || "none"} onValueChange={(v) => setSupervisorId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {supervisors.filter((s) => s.id).map((s) => (
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
            </fieldset>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <LoadingButton
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                loading={isSubmitting}
                loadingText="Creating..."
              >
                Create Employee
              </LoadingButton>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => router.back()}
                disabled={isSubmitting}
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
