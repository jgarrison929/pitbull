"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChevronRight,
  ChevronLeft,
  User,
  Briefcase,
  Phone,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  I9_DOCUMENT_TYPES,
  CERTS_NO_EXPIRATION,
  CERTS_REQUIRE_EXPIRATION,
  CertificationVerificationStatus,
} from "@/lib/types/employee-onboarding";
import type { OnboardingSubmissionDto } from "@/lib/types/employee-onboarding";

// ─── Step Configuration ────────────────────────────────────

const STEPS = [
  { id: 1, label: "Personal Info", icon: User },
  { id: 2, label: "Employment", icon: Briefcase },
  { id: 3, label: "Emergency Contact", icon: Phone },
  { id: 4, label: "Tax & Compliance", icon: FileText },
  { id: 5, label: "Certifications", icon: ShieldCheck },
  { id: 6, label: "Review & Submit", icon: ClipboardCheck },
] as const;

// ─── Certification Types ───────────────────────────────────

const CERT_TYPE_OPTIONS = [
  { value: "OSHA10", label: "OSHA 10-Hour" },
  { value: "OSHA30", label: "OSHA 30-Hour" },
  { value: "FirstAid", label: "First Aid" },
  { value: "CPR", label: "CPR" },
  { value: "AED", label: "AED" },
  { value: "Forklift", label: "Forklift Operator" },
  { value: "AerialLift", label: "Aerial Lift Operator" },
  { value: "CraneMobile", label: "Crane - Mobile" },
  { value: "CraneTower", label: "Crane - Tower" },
  { value: "CraneOverhead", label: "Crane - Overhead" },
  { value: "CDL_A", label: "CDL Class A" },
  { value: "CDL_B", label: "CDL Class B" },
  { value: "CDL_C", label: "CDL Class C" },
  { value: "WeldStructural", label: "Welding - Structural" },
  { value: "WeldPipe", label: "Welding - Pipe" },
  { value: "WeldSpecialty", label: "Welding - Specialty" },
  { value: "Hazmat40", label: "HAZMAT 40-Hour" },
  { value: "HazmatRefresher", label: "HAZMAT Refresher" },
  { value: "AsbestosAwareness", label: "Asbestos Awareness" },
  { value: "LeadAwareness", label: "Lead Awareness" },
  { value: "SilicaAwareness", label: "Silica Awareness" },
  { value: "SteelErection", label: "Steel Erection" },
  { value: "SWPPP", label: "SWPPP" },
  { value: "MSHANewMiner", label: "MSHA New Miner" },
  { value: "MSHARefresher", label: "MSHA Refresher" },
  { value: "NFPA70E", label: "NFPA 70E Arc Flash" },
];

// ─── Form Data Interfaces ──────────────────────────────────

interface PersonalInfoData {
  firstName: string;
  lastName: string;
  middleName: string;
  preferredName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}

interface EmploymentData {
  employeeNumber: string;
  contractorType: string;
  classification: string;
  title: string;
  department: string;
  hireDate: string;
  startDate: string;
  baseHourlyRate: string;
}

interface EmergencyContactData {
  name: string;
  phone: string;
  relationship: string;
}

interface TaxComplianceData {
  w4FilingStatus: string;
  w4AdditionalWithholding: string;
  w4Exempt: boolean;
  i9Status: string;
  i9DocumentTypeA: string;
  i9DocumentTypeB: string;
  i9DocumentTypeC: string;
  i9Section1Date: string;
  i9Section2Date: string;
  i9VerifiedBy: string;
  certifiedPayrollRequired: boolean;
  davisBaconApplicable: boolean;
  payrollNotes: string;
}

interface CertificationRow {
  id: string;
  certificationTypeId: string;
  certificationName: string;
  issuedDate: string;
  expirationDate: string;
  certificateNumber: string;
}

// ─── Defaults ──────────────────────────────────────────────

const DEFAULT_PERSONAL: PersonalInfoData = {
  firstName: "", lastName: "", middleName: "", preferredName: "",
  email: "", phone: "", dateOfBirth: "",
};

const DEFAULT_EMPLOYMENT: EmploymentData = {
  employeeNumber: "", contractorType: "W2Employee", classification: "0",
  title: "", department: "", hireDate: "", startDate: "", baseHourlyRate: "",
};

const DEFAULT_EMERGENCY: EmergencyContactData = {
  name: "", phone: "", relationship: "",
};

const DEFAULT_TAX: TaxComplianceData = {
  w4FilingStatus: "Single", w4AdditionalWithholding: "", w4Exempt: false,
  i9Status: "NotStarted",
  i9DocumentTypeA: "", i9DocumentTypeB: "", i9DocumentTypeC: "",
  i9Section1Date: "", i9Section2Date: "", i9VerifiedBy: "",
  certifiedPayrollRequired: false, davisBaconApplicable: false, payrollNotes: "",
};

function makeCertRow(): CertificationRow {
  return {
    id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    certificationTypeId: "", certificationName: "",
    issuedDate: "", expirationDate: "", certificateNumber: "",
  };
}

// ─── Main Component ────────────────────────────────────────

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form state per step
  const [personal, setPersonal] = useState<PersonalInfoData>(DEFAULT_PERSONAL);
  const [employment, setEmployment] = useState<EmploymentData>(DEFAULT_EMPLOYMENT);
  const [emergency, setEmergency] = useState<EmergencyContactData>(DEFAULT_EMERGENCY);
  const [tax, setTax] = useState<TaxComplianceData>(DEFAULT_TAX);
  const [certifications, setCertifications] = useState<CertificationRow[]>([makeCertRow()]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return !!(personal.firstName && personal.lastName && personal.email && personal.phone);
      case 2:
        return !!(employment.hireDate && employment.startDate && employment.baseHourlyRate);
      case 3:
        return !!(emergency.name && emergency.phone && emergency.relationship);
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, personal, employment, emergency]);

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: OnboardingSubmissionDto = {
        firstName: personal.firstName,
        lastName: personal.lastName,
        middleName: personal.middleName || undefined,
        preferredName: personal.preferredName || undefined,
        email: personal.email,
        phone: personal.phone,
        dateOfBirth: personal.dateOfBirth || undefined,

        employeeNumber: employment.employeeNumber || undefined,
        contractorType: employment.contractorType as OnboardingSubmissionDto["contractorType"],
        classification: parseInt(employment.classification, 10),
        title: employment.title || undefined,
        department: employment.department || undefined,
        hireDate: employment.hireDate,
        startDate: employment.startDate,
        baseHourlyRate: parseFloat(employment.baseHourlyRate) || 0,

        emergencyContactName: emergency.name,
        emergencyContactPhone: emergency.phone,
        emergencyContactRelationship: emergency.relationship,

        w4FilingStatus: tax.w4FilingStatus as OnboardingSubmissionDto["w4FilingStatus"],
        w4AdditionalWithholding: tax.w4AdditionalWithholding
          ? parseFloat(tax.w4AdditionalWithholding)
          : undefined,
        w4Exempt: tax.w4Exempt,
        i9Status: tax.i9Status as OnboardingSubmissionDto["i9Status"],
        i9DocumentTypeA: tax.i9DocumentTypeA || undefined,
        i9DocumentTypeB: tax.i9DocumentTypeB || undefined,
        i9DocumentTypeC: tax.i9DocumentTypeC || undefined,
        i9Section1Date: tax.i9Section1Date || undefined,
        i9Section2Date: tax.i9Section2Date || undefined,
        i9VerifiedBy: tax.i9VerifiedBy || undefined,
        certifiedPayrollRequired: tax.certifiedPayrollRequired,
        davisBaconApplicable: tax.davisBaconApplicable,
        notes: tax.payrollNotes || undefined,

        certifications: certifications
          .filter((c) => c.certificationTypeId)
          .map((c) => ({
            certificationTypeId: c.certificationTypeId,
            certificationName: c.certificationName,
            issuedDate: c.issuedDate || undefined,
            expirationDate: c.expirationDate || undefined,
            certificateNumber: c.certificateNumber || undefined,
            verificationStatus: CertificationVerificationStatus.Pending,
          })),
      };

      await api<OnboardingSubmissionDto>("/api/employee-onboarding", {
        method: "POST",
        body: payload,
      });

      toast.success("Onboarding submission created successfully");
      router.push("/employees");
    } catch {
      toast.error("Failed to submit onboarding form");
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/employees" className="hover:text-foreground transition-colors">
          Employees
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">New Onboarding</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employee Onboarding</h1>
        <p className="text-muted-foreground">
          Complete all steps to create a new employee onboarding submission
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isComplete = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (isComplete || isActive) setStep(s.id);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                  isActive
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    : isComplete
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                    : "text-muted-foreground"
                }`}
                disabled={!isComplete && !isActive}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 1 && (
        <PersonalInfoStep
          data={personal}
          onChange={(patch) => setPersonal((prev) => ({ ...prev, ...patch }))}
        />
      )}
      {step === 2 && (
        <EmploymentStep
          data={employment}
          onChange={(patch) => setEmployment((prev) => ({ ...prev, ...patch }))}
        />
      )}
      {step === 3 && (
        <EmergencyContactStep
          data={emergency}
          onChange={(patch) => setEmergency((prev) => ({ ...prev, ...patch }))}
        />
      )}
      {step === 4 && (
        <TaxComplianceStep
          data={tax}
          onChange={(patch) => setTax((prev) => ({ ...prev, ...patch }))}
        />
      )}
      {step === 5 && (
        <CertificationsStep
          rows={certifications}
          onChange={setCertifications}
        />
      )}
      {step === 6 && (
        <ReviewStep
          personal={personal}
          employment={employment}
          emergency={emergency}
          tax={tax}
          certifications={certifications}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
          className="gap-2 min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <LoadingButton
            onClick={() => setShowConfirm(true)}
            loading={isSubmitting}
            loadingText="Submitting..."
            className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
          >
            Submit Onboarding
          </LoadingButton>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Submit Onboarding?"
        description="This will create a new employee onboarding submission. The submission can be reviewed and edited before final approval."
        onConfirm={handleSubmit}
        isLoading={isSubmitting}
        loadingText="Submitting..."
        confirmLabel="Submit"
        variant="warning"
      />
    </div>
  );
}

// ─── Step 1: Personal Info ─────────────────────────────────

function PersonalInfoStep({
  data,
  onChange,
}: {
  data: PersonalInfoData;
  onChange: (patch: Partial<PersonalInfoData>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>Basic identifying information for the new employee</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={data.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder="John"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={data.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder="Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middleName">Middle Name</Label>
            <Input
              id="middleName"
              value={data.middleName}
              onChange={(e) => onChange({ middleName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred Name</Label>
            <Input
              id="preferredName"
              value={data.preferredName}
              onChange={(e) => onChange({ preferredName: e.target.value })}
              placeholder="Johnny"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="john.doe@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="555-0100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Employment Details ────────────────────────────

function EmploymentStep({
  data,
  onChange,
}: {
  data: EmploymentData;
  onChange: (patch: Partial<EmploymentData>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment Details</CardTitle>
        <CardDescription>Job classification, pay rate, and start dates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="empNum">Employee Number</Label>
            <Input
              id="empNum"
              value={data.employeeNumber}
              onChange={(e) => onChange({ employeeNumber: e.target.value })}
              placeholder="EMP-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Contractor Type</Label>
            <Select value={data.contractorType} onValueChange={(v) => onChange({ contractorType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="W2Employee">W-2 Employee</SelectItem>
                <SelectItem value="Contractor1099">1099 Contractor</SelectItem>
                <SelectItem value="SubContractor">Subcontractor</SelectItem>
                <SelectItem value="TempAgency">Temp Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Classification</Label>
            <Select value={data.classification} onValueChange={(v) => onChange({ classification: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Laborer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <Input
              id="dept"
              value={data.department}
              onChange={(e) => onChange({ department: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Base Hourly Rate *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="rate"
                type="number"
                step="0.25"
                min="0"
                className="pl-7"
                value={data.baseHourlyRate}
                onChange={(e) => onChange({ baseHourlyRate: e.target.value })}
                placeholder="28.50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hireDate">Hire Date *</Label>
            <Input
              id="hireDate"
              type="date"
              value={data.hireDate}
              onChange={(e) => onChange({ hireDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={data.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Emergency Contact ─────────────────────────────

function EmergencyContactStep({
  data,
  onChange,
}: {
  data: EmergencyContactData;
  onChange: (patch: Partial<EmergencyContactData>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Contact</CardTitle>
        <CardDescription>Person to contact in case of workplace emergency</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ecName">Contact Name *</Label>
            <Input
              id="ecName"
              value={data.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ecPhone">Contact Phone *</Label>
            <Input
              id="ecPhone"
              type="tel"
              value={data.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="555-0101"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ecRelationship">Relationship *</Label>
            <Select value={data.relationship} onValueChange={(v) => onChange({ relationship: v })}>
              <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Spouse">Spouse</SelectItem>
                <SelectItem value="Parent">Parent</SelectItem>
                <SelectItem value="Sibling">Sibling</SelectItem>
                <SelectItem value="Child">Child</SelectItem>
                <SelectItem value="Partner">Partner</SelectItem>
                <SelectItem value="Friend">Friend</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── I-9 Document Picker ───────────────────────────────────

/**
 * Conditional I-9 document picker implementing federal rules:
 * - Selecting a List A document satisfies both identity and work auth (hide B+C).
 * - Selecting a List B document requires a companion List C document.
 * - Selecting a List C document requires a companion List B document.
 */
function I9DocumentPicker({
  data,
  onChange,
}: {
  data: TaxComplianceData;
  onChange: (patch: Partial<TaxComplianceData>) => void;
}) {
  const listA = I9_DOCUMENT_TYPES.filter((d) => d.list === "A");
  const listB = I9_DOCUMENT_TYPES.filter((d) => d.list === "B");
  const listC = I9_DOCUMENT_TYPES.filter((d) => d.list === "C");

  const hasListA = !!data.i9DocumentTypeA;
  const hasListBC = !!data.i9DocumentTypeB || !!data.i9DocumentTypeC;

  return (
    <div className="space-y-4">
      {/* Primary document selection: List A (or start of B+C flow) */}
      <div className="space-y-2">
        <Label>I-9 Document (List A, or List B + C)</Label>
        <Select
          value={data.i9DocumentTypeA || data.i9DocumentTypeB || ""}
          onValueChange={(v) => {
            const doc = I9_DOCUMENT_TYPES.find((d) => d.value === v);
            if (!doc) return;
            if (doc.list === "A") {
              // List A: clears B+C
              onChange({ i9DocumentTypeA: v, i9DocumentTypeB: "", i9DocumentTypeC: "" });
            } else if (doc.list === "B") {
              // List B: clears A, keep C
              onChange({ i9DocumentTypeA: "", i9DocumentTypeB: v });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select I-9 document..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>List A -- Identity & Work Authorization</SelectLabel>
              {listA.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>List B -- Identity Only</SelectLabel>
              {listB.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional: if List A selected, show confirmation */}
      {hasListA && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 p-3">
          <Info className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            A List A document establishes both identity and employment authorization.
            No additional documents are needed.
          </p>
        </div>
      )}

      {/* Conditional: if List B selected, must also pick a List C document */}
      {hasListBC && !hasListA && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              A List B document proves identity only. You must also select a List C document
              to establish employment authorization.
            </p>
          </div>
          <div className="space-y-2">
            <Label>List C Document (Work Authorization) *</Label>
            <Select
              value={data.i9DocumentTypeC || ""}
              onValueChange={(v) => onChange({ i9DocumentTypeC: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select List C document..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>List C -- Work Authorization Only</SelectLabel>
                  {listC.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 4: Tax & Compliance ──────────────────────────────

function TaxComplianceStep({
  data,
  onChange,
}: {
  data: TaxComplianceData;
  onChange: (patch: Partial<TaxComplianceData>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax & Compliance</CardTitle>
        <CardDescription>W-4 withholding, I-9 verification, and payroll compliance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* W-4 Section */}
        <div>
          <h3 className="text-sm font-semibold mb-3">W-4 Withholding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select value={data.w4FilingStatus} onValueChange={(v) => onChange({ w4FilingStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="MarriedFilingJointly">Married Filing Jointly</SelectItem>
                  <SelectItem value="HeadOfHousehold">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="w4extra">Additional Withholding</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="w4extra"
                  type="number"
                  step="1"
                  min="0"
                  className="pl-7"
                  value={data.w4AdditionalWithholding}
                  onChange={(e) => onChange({ w4AdditionalWithholding: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <div className="space-y-0.5">
                <Label>Exempt from Withholding</Label>
                <p className="text-xs text-muted-foreground">Claim exemption from federal income tax</p>
              </div>
              <Switch
                checked={data.w4Exempt}
                onCheckedChange={(checked) => onChange({ w4Exempt: checked })}
              />
            </div>
          </div>
        </div>

        {/* I-9 Section */}
        <div>
          <h3 className="text-sm font-semibold mb-3">I-9 Employment Eligibility</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>I-9 Status</Label>
              <Select value={data.i9Status} onValueChange={(v) => onChange({ i9Status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NotStarted">Not Started</SelectItem>
                  <SelectItem value="Section1Complete">Section 1 Complete</SelectItem>
                  <SelectItem value="Section2Complete">Section 2 Complete</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Reverified">Re-verified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <I9DocumentPicker data={data} onChange={onChange} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="i9s1">Section 1 Date</Label>
                <Input
                  id="i9s1"
                  type="date"
                  value={data.i9Section1Date}
                  onChange={(e) => onChange({ i9Section1Date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i9s2">Section 2 Date</Label>
                <Input
                  id="i9s2"
                  type="date"
                  value={data.i9Section2Date}
                  onChange={(e) => onChange({ i9Section2Date: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i9verifier">Verified By</Label>
                <Input
                  id="i9verifier"
                  value={data.i9VerifiedBy}
                  onChange={(e) => onChange({ i9VerifiedBy: e.target.value })}
                  placeholder="Employer representative name"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payroll Compliance */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Payroll Compliance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Certified Payroll Required</Label>
                <p className="text-xs text-muted-foreground">Include on certified payroll reports</p>
              </div>
              <Switch
                checked={data.certifiedPayrollRequired}
                onCheckedChange={(checked) => onChange({ certifiedPayrollRequired: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Davis-Bacon Applicable</Label>
                <p className="text-xs text-muted-foreground">Subject to prevailing wage requirements</p>
              </div>
              <Switch
                checked={data.davisBaconApplicable}
                onCheckedChange={(checked) => onChange({ davisBaconApplicable: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payrollNotes">Payroll Notes</Label>
              <Textarea
                id="payrollNotes"
                value={data.payrollNotes}
                onChange={(e) => onChange({ payrollNotes: e.target.value })}
                placeholder="Additional payroll instructions..."
                rows={3}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 5: Certifications ────────────────────────────────

function CertificationsStep({
  rows,
  onChange,
}: {
  rows: CertificationRow[];
  onChange: (rows: CertificationRow[]) => void;
}) {
  const addRow = () => onChange([...rows, makeCertRow()]);

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<CertificationRow>) => {
    onChange(
      rows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        // When cert type changes, sync the name and clear expiration if not needed
        if (patch.certificationTypeId !== undefined) {
          const opt = CERT_TYPE_OPTIONS.find((o) => o.value === patch.certificationTypeId);
          updated.certificationName = opt?.label || "";
          if (CERTS_NO_EXPIRATION.has(patch.certificationTypeId)) {
            updated.expirationDate = "";
          }
        }
        return updated;
      })
    );
  };

  const getExpirationStatus = (row: CertificationRow) => {
    if (!row.certificationTypeId) return null;
    if (CERTS_NO_EXPIRATION.has(row.certificationTypeId)) return "no-expiration";
    if (!CERTS_REQUIRE_EXPIRATION.has(row.certificationTypeId)) return null;
    if (!row.expirationDate) return "missing";
    const exp = new Date(row.expirationDate);
    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    if (exp < now) return "expired";
    if (exp < thirtyDays) return "expiring-soon";
    return "valid";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Certifications & Training</CardTitle>
            <CardDescription>Safety certifications and professional licenses</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            + Add Certification
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row, index) => {
          const expStatus = getExpirationStatus(row);
          const requiresExp = row.certificationTypeId && CERTS_REQUIRE_EXPIRATION.has(row.certificationTypeId);
          const neverExpires = row.certificationTypeId && CERTS_NO_EXPIRATION.has(row.certificationTypeId);

          return (
            <div key={row.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Certification {index + 1}</span>
                <div className="flex items-center gap-2">
                  {/* Expiration badges */}
                  {expStatus === "no-expiration" && (
                    <Badge variant="secondary" className="text-xs">
                      Does not expire
                    </Badge>
                  )}
                  {expStatus === "expired" && (
                    <Badge variant="destructive" className="text-xs">
                      Expired
                    </Badge>
                  )}
                  {expStatus === "expiring-soon" && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs">
                      Expiring soon
                    </Badge>
                  )}
                  {expStatus === "missing" && (
                    <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                      Expiration required
                    </Badge>
                  )}
                  {expStatus === "valid" && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 text-xs">
                      Valid
                    </Badge>
                  )}
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    >
                      &times;
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Certification Type</Label>
                  <Select
                    value={row.certificationTypeId}
                    onValueChange={(v) => updateRow(row.id, { certificationTypeId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {CERT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cert-num-${row.id}`}>Certificate Number</Label>
                  <Input
                    id={`cert-num-${row.id}`}
                    value={row.certificateNumber}
                    onChange={(e) => updateRow(row.id, { certificateNumber: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cert-issued-${row.id}`}>Issued Date</Label>
                  <Input
                    id={`cert-issued-${row.id}`}
                    type="date"
                    value={row.issuedDate}
                    onChange={(e) => updateRow(row.id, { issuedDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cert-exp-${row.id}`}>
                    Expiration Date{requiresExp ? " *" : ""}
                  </Label>
                  {neverExpires ? (
                    <div className="flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground bg-muted rounded-md">
                      <Info className="h-4 w-4" />
                      This certification does not expire
                    </div>
                  ) : (
                    <Input
                      id={`cert-exp-${row.id}`}
                      type="date"
                      value={row.expirationDate}
                      onChange={(e) => updateRow(row.id, { expirationDate: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Step 6: Review & Submit ───────────────────────────────

function ReviewStep({
  personal,
  employment,
  emergency,
  tax,
  certifications,
}: {
  personal: PersonalInfoData;
  employment: EmploymentData;
  emergency: EmergencyContactData;
  tax: TaxComplianceData;
  certifications: CertificationRow[];
}) {
  const classLabels: Record<string, string> = {
    "0": "Hourly", "1": "Salaried", "2": "Contractor", "3": "Apprentice", "4": "Supervisor",
  };

  const activeCerts = certifications.filter((c) => c.certificationTypeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Submit</CardTitle>
        <CardDescription>
          Review all information before submitting. You can go back to any step to make changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">PERSONAL INFORMATION</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {personal.firstName} {personal.middleName} {personal.lastName}</div>
            {personal.preferredName && (
              <div><span className="text-muted-foreground">Preferred:</span> {personal.preferredName}</div>
            )}
            <div><span className="text-muted-foreground">Email:</span> {personal.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {personal.phone}</div>
            {personal.dateOfBirth && (
              <div><span className="text-muted-foreground">DOB:</span> {personal.dateOfBirth}</div>
            )}
          </div>
        </div>

        {/* Employment */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">EMPLOYMENT DETAILS</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {employment.employeeNumber && (
              <div><span className="text-muted-foreground">Employee #:</span> {employment.employeeNumber}</div>
            )}
            <div><span className="text-muted-foreground">Classification:</span> {classLabels[employment.classification] || employment.classification}</div>
            <div><span className="text-muted-foreground">Rate:</span> ${employment.baseHourlyRate}/hr</div>
            <div><span className="text-muted-foreground">Hire Date:</span> {employment.hireDate}</div>
            <div><span className="text-muted-foreground">Start Date:</span> {employment.startDate}</div>
            {employment.title && (
              <div><span className="text-muted-foreground">Title:</span> {employment.title}</div>
            )}
          </div>
        </div>

        {/* Emergency */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">EMERGENCY CONTACT</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {emergency.name}</div>
            <div><span className="text-muted-foreground">Phone:</span> {emergency.phone}</div>
            <div><span className="text-muted-foreground">Relationship:</span> {emergency.relationship}</div>
          </div>
        </div>

        {/* Tax */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">TAX & COMPLIANCE</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">W-4 Status:</span> {tax.w4FilingStatus}</div>
            <div><span className="text-muted-foreground">I-9 Status:</span> {tax.i9Status}</div>
            {tax.i9DocumentTypeA && (
              <div>
                <span className="text-muted-foreground">I-9 Doc (List A):</span>{" "}
                {I9_DOCUMENT_TYPES.find((d) => d.value === tax.i9DocumentTypeA)?.label || tax.i9DocumentTypeA}
              </div>
            )}
            {tax.i9DocumentTypeB && (
              <div>
                <span className="text-muted-foreground">I-9 Doc (List B):</span>{" "}
                {I9_DOCUMENT_TYPES.find((d) => d.value === tax.i9DocumentTypeB)?.label || tax.i9DocumentTypeB}
              </div>
            )}
            {tax.i9DocumentTypeC && (
              <div>
                <span className="text-muted-foreground">I-9 Doc (List C):</span>{" "}
                {I9_DOCUMENT_TYPES.find((d) => d.value === tax.i9DocumentTypeC)?.label || tax.i9DocumentTypeC}
              </div>
            )}
            {tax.certifiedPayrollRequired && (
              <div><Badge variant="outline">Certified Payroll</Badge></div>
            )}
            {tax.davisBaconApplicable && (
              <div><Badge variant="outline">Davis-Bacon</Badge></div>
            )}
          </div>
        </div>

        {/* Certifications */}
        {activeCerts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              CERTIFICATIONS ({activeCerts.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeCerts.map((c) => {
                const neverExpires = CERTS_NO_EXPIRATION.has(c.certificationTypeId);
                const isExpired = c.expirationDate && new Date(c.expirationDate) < new Date();
                return (
                  <Badge
                    key={c.id}
                    variant="secondary"
                    className={
                      isExpired
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                        : neverExpires
                        ? ""
                        : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                    }
                  >
                    {c.certificationName}
                    {neverExpires && " (no expiry)"}
                    {isExpired && " (expired)"}
                    {c.expirationDate && !isExpired && ` (exp: ${c.expirationDate})`}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
