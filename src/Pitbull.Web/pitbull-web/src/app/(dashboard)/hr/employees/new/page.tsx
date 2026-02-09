"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { HelpCircle, ArrowLeft } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import api from "@/lib/api";
import type { CreateHREmployeeCommand, HREmployeeDto } from "@/lib/hr-types";
import {
  WorkerType,
  FLSAStatus,
  EmploymentType,
  PayFrequency,
  PayType,
  PaymentMethod,
} from "@/lib/hr-types";
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
    | "employeeNumber"
    | "firstName"
    | "lastName"
    | "dateOfBirth"
    | "ssn"
    | "email"
    | "phone"
    | "defaultHourlyRate"
    | "general",
    string
  >
>;

// US States for dropdown
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export default function NewHREmployeePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Identity - Required
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ssn, setSSN] = useState(""); // Will be encrypted before sending

  // Identity - Optional
  const [middleName, setMiddleName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [suffix, setSuffix] = useState("");

  // Contact
  const [email, setEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Employment
  const [hireDate, setHireDate] = useState(getTodayISO());
  const [workerType, setWorkerType] = useState<string>(String(WorkerType.Field));
  const [flsaStatus, setFLSAStatus] = useState<string>(String(FLSAStatus.NonExempt));
  const [employmentType, setEmploymentType] = useState<string>(String(EmploymentType.FullTime));

  // Classification
  const [jobTitle, setJobTitle] = useState("");
  const [tradeCode, setTradeCode] = useState("");
  const [workersCompClassCode, setWorkersCompClassCode] = useState("");

  // Tax
  const [homeState, setHomeState] = useState("");
  const [suiState, setSUIState] = useState("");

  // Payroll
  const [payFrequency, setPayFrequency] = useState<string>(String(PayFrequency.Weekly));
  const [defaultPayType, setDefaultPayType] = useState<string>(String(PayType.Hourly));
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<string>(String(PaymentMethod.DirectDeposit));

  // Union
  const [isUnionMember, setIsUnionMember] = useState(false);

  // Notes
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});

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
    if (!dateOfBirth) {
      next.dateOfBirth = "Date of birth is required";
    }
    if (!ssn.trim() || !/^\d{9}$/.test(ssn.replace(/-/g, ""))) {
      next.ssn = "SSN must be 9 digits";
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Please enter a valid email address";
    }
    if (phone && !isValidPhoneNumber(phone)) {
      next.phone = "Please enter a valid 10-digit phone number";
    }

    const rate = parseFloat(defaultHourlyRate);
    if (isNaN(rate) || rate < 0) {
      next.defaultHourlyRate = "Rate must be a positive number";
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

    // For SSN, we'd normally encrypt this client-side before sending
    // For now, we'll send it (backend should handle encryption)
    const ssnClean = ssn.replace(/-/g, "");
    const ssnLast4 = ssnClean.slice(-4);

    const command: CreateHREmployeeCommand = {
      employeeNumber: employeeNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth,
      ssnEncrypted: ssnClean, // Backend should encrypt this
      ssnLast4: ssnLast4,
      middleName: middleName.trim() || undefined,
      preferredName: preferredName.trim() || undefined,
      suffix: suffix.trim() || undefined,
      email: email.trim() || undefined,
      personalEmail: personalEmail.trim() || undefined,
      phone: phone.trim() || undefined,
      secondaryPhone: secondaryPhone.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      zipCode: zipCode.trim() || undefined,
      country: "US",
      hireDate: hireDate || undefined,
      workerType: parseInt(workerType) as WorkerType,
      flsaStatus: parseInt(flsaStatus) as FLSAStatus,
      employmentType: parseInt(employmentType) as EmploymentType,
      jobTitle: jobTitle.trim() || undefined,
      tradeCode: tradeCode.trim() || undefined,
      workersCompClassCode: workersCompClassCode.trim() || undefined,
      homeState: homeState || undefined,
      suiState: suiState || undefined,
      payFrequency: parseInt(payFrequency) as PayFrequency,
      defaultPayType: parseInt(defaultPayType) as PayType,
      defaultHourlyRate: parseFloat(defaultHourlyRate) || undefined,
      paymentMethod: parseInt(paymentMethod) as PaymentMethod,
      isUnionMember: isUnionMember,
      notes: notes.trim() || undefined,
    };

    try {
      const result = await api<HREmployeeDto>("/api/hr/employees", {
        method: "POST",
        body: command,
      });
      toast.success("Employee created successfully");
      router.push(`/hr/employees/${result.id}`);
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

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hr/employees">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New HR Employee</h1>
          <p className="text-muted-foreground">
            Add a new employee to HR Core
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={isSubmitting} className="space-y-6">
          {/* Identity - Required */}
          <Card>
            <CardHeader>
              <CardTitle>Identity Information</CardTitle>
              <CardDescription>Required employee identification details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label htmlFor="ssn">Social Security Number *</Label>
                  <Input
                    id="ssn"
                    type="password"
                    value={ssn}
                    onChange={(e) => setSSN(e.target.value)}
                    placeholder="123-45-6789"
                    required
                  />
                  {errors.ssn && (
                    <p className="text-sm text-destructive">{errors.ssn}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Michael"
                  />
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

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="preferredName">Preferred Name</Label>
                  <Input
                    id="preferredName"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="Johnny"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="Jr., Sr., III"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                  {errors.dateOfBirth && (
                    <p className="text-sm text-destructive">{errors.dateOfBirth}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Email and phone numbers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@company.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalEmail">Personal Email</Label>
                  <Input
                    id="personalEmail"
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="johndoe@gmail.com"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PhoneInput
                  id="phone"
                  label="Primary Phone"
                  value={phone}
                  onChange={setPhone}
                  error={errors.phone}
                />
                <PhoneInput
                  id="secondaryPhone"
                  label="Secondary Phone"
                  value={secondaryPhone}
                  onChange={setSecondaryPhone}
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Employee&apos;s home address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Street Address</Label>
                <Input
                  id="addressLine1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Apt/Suite/Unit</Label>
                <Input
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apt 4B"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Los Angeles"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="90210"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment */}
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
              <CardDescription>Job classification and hire information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div className="flex items-center gap-1">
                    <Label htmlFor="workerType">Worker Type</Label>
                    <SimpleTooltip content="Field workers are on job sites, Office workers are administrative">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </SimpleTooltip>
                  </div>
                  <Select value={workerType} onValueChange={setWorkerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(WorkerType.Field)}>Field</SelectItem>
                      <SelectItem value={String(WorkerType.Office)}>Office</SelectItem>
                      <SelectItem value={String(WorkerType.Hybrid)}>Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="flsaStatus">FLSA Status</Label>
                    <SimpleTooltip content="Non-Exempt: Eligible for overtime. Exempt: Salaried, no overtime.">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </SimpleTooltip>
                  </div>
                  <Select value={flsaStatus} onValueChange={setFLSAStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(FLSAStatus.NonExempt)}>Non-Exempt (Hourly)</SelectItem>
                      <SelectItem value={String(FLSAStatus.Exempt)}>Exempt (Salaried)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(EmploymentType.FullTime)}>Full-Time</SelectItem>
                      <SelectItem value={String(EmploymentType.PartTime)}>Part-Time</SelectItem>
                      <SelectItem value={String(EmploymentType.Seasonal)}>Seasonal</SelectItem>
                      <SelectItem value={String(EmploymentType.Temporary)}>Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Carpenter, Electrician..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradeCode">Trade Code</Label>
                  <Input
                    id="tradeCode"
                    value={tradeCode}
                    onChange={(e) => setTradeCode(e.target.value)}
                    placeholder="CARP, ELEC..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workersCompClassCode">Workers&apos; Comp Class Code</Label>
                  <Input
                    id="workersCompClassCode"
                    value={workersCompClassCode}
                    onChange={(e) => setWorkersCompClassCode(e.target.value)}
                    placeholder="5403"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isUnionMember"
                  checked={isUnionMember}
                  onCheckedChange={(checked) => setIsUnionMember(checked === true)}
                />
                <Label htmlFor="isUnionMember" className="font-normal">
                  Union member
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Payroll */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Settings</CardTitle>
              <CardDescription>Pay frequency, rates, and tax information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payFrequency">Pay Frequency</Label>
                  <Select value={payFrequency} onValueChange={setPayFrequency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(PayFrequency.Weekly)}>Weekly</SelectItem>
                      <SelectItem value={String(PayFrequency.BiWeekly)}>Bi-Weekly</SelectItem>
                      <SelectItem value={String(PayFrequency.SemiMonthly)}>Semi-Monthly</SelectItem>
                      <SelectItem value={String(PayFrequency.Monthly)}>Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultPayType">Default Pay Type</Label>
                  <Select value={defaultPayType} onValueChange={setDefaultPayType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(PayType.Hourly)}>Hourly</SelectItem>
                      <SelectItem value={String(PayType.Salary)}>Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultHourlyRate">Default Hourly Rate ($)</Label>
                  <Input
                    id="defaultHourlyRate"
                    type="number"
                    value={defaultHourlyRate}
                    onChange={(e) => setDefaultHourlyRate(e.target.value)}
                    min={0}
                    step={0.01}
                    placeholder="25.00"
                  />
                  {errors.defaultHourlyRate && (
                    <p className="text-sm text-destructive">{errors.defaultHourlyRate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(PaymentMethod.DirectDeposit)}>Direct Deposit</SelectItem>
                      <SelectItem value={String(PaymentMethod.Check)}>Check</SelectItem>
                      <SelectItem value={String(PaymentMethod.PayCard)}>Pay Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="homeState">Home State (Tax)</Label>
                    <SimpleTooltip content="State where employee lives for tax withholding">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </SimpleTooltip>
                  </div>
                  <Select value={homeState} onValueChange={setHomeState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="suiState">SUI State</Label>
                    <SimpleTooltip content="State Unemployment Insurance state">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </SimpleTooltip>
                  </div>
                  <Select value={suiState} onValueChange={setSUIState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Additional information (optional)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this employee..."
                rows={4}
              />
            </CardContent>
          </Card>
        </fieldset>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
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
    </div>
  );
}
