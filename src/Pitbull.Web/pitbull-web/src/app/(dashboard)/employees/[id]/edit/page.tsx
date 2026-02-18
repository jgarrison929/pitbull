"use client";

import { useEffect, useState, useMemo, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { FormSection } from "@/components/ui/form-section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle,
  ArrowLeft,
  User,
  Briefcase,
  Phone,
  StickyNote,
  ShieldCheck,
  X,
} from "lucide-react";
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
} from "@/components/ui/card";
import api from "@/lib/api";
import type {
  UpdateEmployeeCommand,
  Employee,
  ListEmployeesResult,
  EmployeeClassification,
} from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RATE_SUGGESTIONS: Record<string, { label: string; rate: number }[]> = {
  "0": [
    { label: "Entry Level", rate: 22.0 },
    { label: "Journeyman", rate: 35.0 },
    { label: "Senior", rate: 45.0 },
  ],
  "1": [
    { label: "Standard", rate: 40.0 },
    { label: "Senior", rate: 55.0 },
    { label: "Executive", rate: 75.0 },
  ],
  "2": [
    { label: "Standard", rate: 50.0 },
    { label: "Specialist", rate: 75.0 },
    { label: "Expert", rate: 100.0 },
  ],
  "3": [
    { label: "1st Year", rate: 16.0 },
    { label: "2nd Year", rate: 19.0 },
    { label: "3rd Year", rate: 22.0 },
  ],
  "4": [
    { label: "Foreman", rate: 45.0 },
    { label: "Superintendent", rate: 55.0 },
    { label: "Senior Super", rate: 70.0 },
  ],
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
];

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

const CERTIFICATION_TEMPLATES = [
  { name: "OSHA 10-Hour", icon: "🦺" },
  { name: "OSHA 30-Hour", icon: "🦺" },
  { name: "First Aid / CPR", icon: "🩺" },
  { name: "Forklift Operation", icon: "🏗️" },
  { name: "Confined Space", icon: "⚠️" },
  { name: "Fall Protection", icon: "🪢" },
  { name: "Scaffolding", icon: "🏗️" },
  { name: "Welding Cert", icon: "🔥" },
  { name: "Electrical License", icon: "⚡" },
  { name: "CDL", icon: "🚛" },
];

type FormErrors = Partial<
  Record<
    "firstName" | "lastName" | "email" | "phone" | "baseHourlyRate" | "general",
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
  const [initialData, setInitialData] = useState<string>("");

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
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [initialCerts, setInitialCerts] = useState<
    { id: string; certificationName: string }[]
  >([]);
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");
  const [emergencyContactId, setEmergencyContactId] = useState<string | null>(
    null
  );

  // Supervisor search
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const supervisorRef = useRef<HTMLDivElement>(null);

  const [supervisors, setSupervisors] = useState<Employee[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // Track dirty state for unsaved changes warning
  const currentData = JSON.stringify({
    firstName, lastName, email, phone, title, classification,
    baseHourlyRate, hireDate, terminationDate, supervisorId, isActive, notes,
  });
  const hasChanges = initialData !== "" && currentData !== initialData;
  useUnsavedChanges(hasChanges);

  // Close supervisor dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (supervisorRef.current && !supervisorRef.current.contains(e.target as Node)) {
        setShowSupervisorDropdown(false);
      }
    }
    if (showSupervisorDropdown) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSupervisorDropdown]);

  useEffect(() => {
    async function loadData() {
      try {
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
        setNotes("");

        // Track initial data for dirty detection
        setInitialData(JSON.stringify({
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email || "",
          phone: employee.phone || "",
          title: employee.title || "",
          classification: employee.classification.toString(),
          baseHourlyRate: employee.baseHourlyRate.toString(),
          hireDate: employee.hireDate ? employee.hireDate.split("T")[0] : "",
          terminationDate: employee.terminationDate ? employee.terminationDate.split("T")[0] : "",
          supervisorId: employee.supervisorId || "",
          isActive: employee.isActive,
          notes: "",
        }));

        const [result, certsResult, contactsResult] = await Promise.all([
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=200"),
          api<{ id: string; certificationName: string }[]>(
            `/api/employee-onboarding/${resolvedParams.id}/certifications`
          ).catch(() => [] as { id: string; certificationName: string }[]),
          api<
            {
              id: string;
              name: string;
              relationship: string;
              phone: string;
            }[]
          >(
            `/api/employee-onboarding/${resolvedParams.id}/emergency-contacts`
          ).catch(
            () =>
              [] as {
                id: string;
                name: string;
                relationship: string;
                phone: string;
              }[]
          ),
        ]);
        setSupervisors(result.items.filter((e) => e.id !== resolvedParams.id));

        // Load existing certifications
        if (certsResult.length > 0) {
          setInitialCerts(certsResult);
          setSelectedCerts(certsResult.map((c) => c.certificationName));
        }

        // Load primary emergency contact
        if (contactsResult.length > 0) {
          const primary = contactsResult[0];
          setEmergencyContactId(primary.id);
          setEmergencyContactName(primary.name);
          setEmergencyContactPhone(primary.phone);
          setEmergencyContactRelation(primary.relationship);
        }
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

  const filteredSupervisors = useMemo(() => {
    if (!supervisorSearch.trim()) return supervisors;
    const q = supervisorSearch.toLowerCase();
    return supervisors.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.employeeNumber.toLowerCase().includes(q) ||
        (s.title && s.title.toLowerCase().includes(q))
    );
  }, [supervisors, supervisorSearch]);

  const selectedSupervisor = useMemo(
    () => supervisors.find((s) => s.id === supervisorId),
    [supervisors, supervisorId]
  );

  function toggleCert(certName: string) {
    setSelectedCerts((prev) =>
      prev.includes(certName)
        ? prev.filter((c) => c !== certName)
        : [...prev, certName]
    );
  }

  const rateSuggestions = RATE_SUGGESTIONS[classification] || [];

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
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

      // Sync certifications: add new, remove deselected
      const followUps: Promise<unknown>[] = [];

      const existingCertNames = new Set(
        initialCerts.map((c) => c.certificationName)
      );
      const newCerts = selectedCerts.filter((n) => !existingCertNames.has(n));
      const removedCerts = initialCerts.filter(
        (c) => !selectedCerts.includes(c.certificationName)
      );

      for (const certName of newCerts) {
        followUps.push(
          api(
            `/api/employee-onboarding/${resolvedParams.id}/certifications`,
            {
              method: "POST",
              body: {
                certificationType: certName,
                certificationName: certName,
                issuedDate: new Date().toISOString(),
              },
            }
          )
        );
      }

      for (const cert of removedCerts) {
        followUps.push(
          api(
            `/api/employee-onboarding/${resolvedParams.id}/certifications/${cert.id}`,
            { method: "DELETE" }
          )
        );
      }

      // Save emergency contact
      if (emergencyContactName.trim() && emergencyContactPhone.trim()) {
        if (!emergencyContactId) {
          followUps.push(
            api(
              `/api/employee-onboarding/${resolvedParams.id}/emergency-contacts`,
              {
                method: "POST",
                body: {
                  name: emergencyContactName.trim(),
                  relationship:
                    emergencyContactRelation.trim() || "Not specified",
                  phone: emergencyContactPhone.trim(),
                  isPrimary: true,
                },
              }
            )
          );
        }
      }

      const results = await Promise.allSettled(followUps);
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        toast.warning(
          `Employee saved but ${failures.length} related record(s) failed to update`
        );
      }

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
      <div className="max-w-3xl space-y-6">
        <Breadcrumbs items={[
          { label: "Employees", href: "/employees" },
          { label: "Loading..." },
        ]} />
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
      <div className="max-w-3xl space-y-6">
        <Breadcrumbs items={[
          { label: "Employees", href: "/employees" },
          { label: "Not Found" },
        ]} />
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

  const initials = getInitials(firstName || "N", lastName || "E");
  const avatarColor = getAvatarColor(`${firstName} ${lastName}`);

  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumbs items={[
        { label: "Employees", href: "/employees" },
        { label: `${firstName} ${lastName}`.trim() || employeeNumber, href: `/employees/${resolvedParams.id}` },
        { label: "Edit" },
      ]} />

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

      {hasChanges && (
        <div className="rounded-md border border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          You have unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting} className="space-y-4">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 pb-2">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold transition-all",
                avatarColor
              )}
            >
              {initials}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{`${firstName} ${lastName}`.trim()}</p>
              <p className="text-sm text-muted-foreground">
                {title || "No title"} · {employeeNumber}
              </p>
              {!isActive && (
                <Badge variant="secondary" className="mt-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  Inactive
                </Badge>
              )}
            </div>
          </div>

          {/* Section 1: Basic Info */}
          <FormSection
            title="Basic Information"
            description="Name, contact, and identification"
            icon={<User className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Carpenter, Electrician, Project Manager..."
                />
              </div>
            </div>
          </FormSection>

          {/* Section 2: Employment Details */}
          <FormSection
            title="Employment Details"
            description="Classification, rate, dates, and supervisor"
            icon={<Briefcase className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="classification">
                      Classification <span className="text-destructive">*</span>
                    </Label>
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

              {/* Rate Suggestions */}
              {rateSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Suggested rates:</span>
                  {rateSuggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setBaseHourlyRate(s.rate.toFixed(2))}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-900/20",
                        parseFloat(baseHourlyRate) === s.rate
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {s.label}: ${s.rate.toFixed(2)}
                    </button>
                  ))}
                </div>
              )}

              {/* Dates */}
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

              {/* Supervisor Autocomplete */}
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <div ref={supervisorRef} className="relative">
                  {selectedSupervisor ? (
                    <div className="flex items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                          getAvatarColor(selectedSupervisor.fullName)
                        )}
                      >
                        {getInitials(selectedSupervisor.firstName, selectedSupervisor.lastName)}
                      </span>
                      <span className="flex-1">
                        {selectedSupervisor.fullName}
                        <span className="ml-1 text-muted-foreground text-xs">
                          ({selectedSupervisor.employeeNumber})
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => {
                          setSupervisorId("");
                          setSupervisorSearch("");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      value={supervisorSearch}
                      onChange={(e) => {
                        setSupervisorSearch(e.target.value);
                        setShowSupervisorDropdown(true);
                      }}
                      onFocus={() => setShowSupervisorDropdown(true)}
                      placeholder="Search by name, number, or title..."
                    />
                  )}

                  {showSupervisorDropdown && !selectedSupervisor && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto animate-in fade-in-0 zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setSupervisorId("");
                          setShowSupervisorDropdown(false);
                          setSupervisorSearch("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <span className="text-muted-foreground">None</span>
                      </button>
                      {filteredSupervisors.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSupervisorId(s.id);
                            setShowSupervisorDropdown(false);
                            setSupervisorSearch("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                              getAvatarColor(s.fullName)
                            )}
                          >
                            {getInitials(s.firstName, s.lastName)}
                          </span>
                          <div className="flex-1 text-left">
                            <span className="font-medium">{s.fullName}</span>
                            <span className="ml-1 text-muted-foreground text-xs">
                              {s.employeeNumber}
                            </span>
                            {s.title && (
                              <span className="ml-1 text-muted-foreground text-xs">
                                · {s.title}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredSupervisors.length === 0 && (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No matches found
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
            </div>
          </FormSection>

          {/* Section 3: Emergency Contact */}
          <FormSection
            title="Emergency Contact"
            description="Emergency contact information"
            icon={<Phone className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelation">Relationship</Label>
                  <Input
                    id="emergencyContactRelation"
                    value={emergencyContactRelation}
                    onChange={(e) => setEmergencyContactRelation(e.target.value)}
                    placeholder="Spouse, Parent, Sibling..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>
          </FormSection>

          {/* Section 4: Certifications */}
          <FormSection
            title="Certifications & Licenses"
            description="Track required certifications"
            icon={<ShieldCheck className="h-4 w-4" />}
            defaultOpen={false}
            badge={
              selectedCerts.length > 0 ? (
                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {selectedCerts.length}
                </Badge>
              ) : undefined
            }
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select certifications this employee holds. Tracking and expiration dates coming soon.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CERTIFICATION_TEMPLATES.map((cert) => {
                  const isSelected = selectedCerts.includes(cert.name);
                  return (
                    <button
                      key={cert.name}
                      type="button"
                      onClick={() => toggleCert(cert.name)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all text-left",
                        isSelected
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500/50"
                          : "border-border hover:border-amber-300 hover:bg-accent/30"
                      )}
                    >
                      <span className="text-base">{cert.icon}</span>
                      <span className={cn("flex-1 text-xs font-medium", isSelected && "text-amber-700 dark:text-amber-300")}>
                        {cert.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </FormSection>

          {/* Section 5: Notes */}
          <FormSection
            title="Notes"
            description="Additional information"
            icon={<StickyNote className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="space-y-2">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this employee..."
                rows={4}
              />
            </div>
          </FormSection>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <LoadingButton
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
              loading={isSubmitting}
              loadingText="Saving..."
            >
              Save Changes
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
        </fieldset>
      </form>
    </div>
  );
}
