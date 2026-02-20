"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings,
  FileCode,
  Handshake,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import api from "@/lib/api";
import { toast } from "sonner";

interface BidItemPreview {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  suggestedCostCode: string | null;
}

interface ConversionPreview {
  bidId: string;
  bidName: string;
  bidNumber: string;
  estimatedValue: number;
  owner: string | null;
  description: string | null;
  items: BidItemPreview[];
}

interface CostCodeMapping {
  bidItemId: string;
  costCode: string;
  description: string;
}

interface ConversionResult {
  projectId: string;
  bidId: string;
  projectName: string;
  projectNumber: string;
  budgetId: string | null;
  subcontractsCreated: number;
  costCodesMapped: number;
}

const STEPS = [
  { label: "Review Bid", icon: ClipboardList },
  { label: "Configure Project", icon: Settings },
  { label: "Map Cost Codes", icon: FileCode },
  { label: "Subcontracts", icon: Handshake },
  { label: "Confirm", icon: CheckCircle2 },
];

const PROJECT_TYPES: { value: string; label: string }[] = [
  { value: "0", label: "Commercial" },
  { value: "1", label: "Residential" },
  { value: "2", label: "Industrial" },
  { value: "3", label: "Infrastructure" },
  { value: "4", label: "Renovation" },
  { value: "5", label: "Tenant Improvement" },
  { value: "6", label: "Other" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ConvertBidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [currentStep, setCurrentStep] = useState(0);
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversionResult, setConversionResult] =
    useState<ConversionResult | null>(null);

  // Step 2: Project config
  const [projectNumber, setProjectNumber] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("0");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");

  // Step 3: Cost code mappings
  const [costCodeMappings, setCostCodeMappings] = useState<CostCodeMapping[]>(
    []
  );

  // Step 4: Subcontracts
  const [createBudget, setCreateBudget] = useState(true);
  const [createSubcontracts, setCreateSubcontracts] = useState(false);

  const initializeFromPreview = useCallback((data: ConversionPreview) => {
    setProjectName(data.bidName);
    setDescription(data.description || "");
    setClientName(data.owner || "");

    // Initialize cost code mappings from preview suggestions
    const mappings = data.items
      .filter((item) => item.suggestedCostCode)
      .map((item) => ({
        bidItemId: item.id,
        costCode: item.suggestedCostCode!,
        description: item.description,
      }));
    setCostCodeMappings(mappings);
  }, []);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const data = await api<ConversionPreview>(
          `/api/bids/${id}/conversion-preview`
        );
        setPreview(data);
        initializeFromPreview(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load bid data";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPreview();
  }, [id, initializeFromPreview]);

  function updateCostCodeMapping(bidItemId: string, costCode: string) {
    setCostCodeMappings((prev) => {
      const existing = prev.find((m) => m.bidItemId === bidItemId);
      if (existing) {
        return prev.map((m) =>
          m.bidItemId === bidItemId ? { ...m, costCode } : m
        );
      }
      const item = preview?.items.find((i) => i.id === bidItemId);
      return [
        ...prev,
        { bidItemId, costCode, description: item?.description || "" },
      ];
    });
  }

  async function handleConvert() {
    if (!projectNumber.trim()) {
      toast.error("Project number is required");
      return;
    }

    setIsConverting(true);
    try {
      const result = await api<ConversionResult>(
        `/api/bids/${id}/convert-to-project`,
        {
          method: "POST",
          body: {
            projectNumber: projectNumber.trim(),
            projectName: projectName.trim() || undefined,
            description: description.trim() || undefined,
            projectType: parseInt(projectType),
            address: address.trim() || undefined,
            city: city.trim() || undefined,
            state: state.trim() || undefined,
            zipCode: zipCode.trim() || undefined,
            clientName: clientName.trim() || undefined,
            clientContact: clientContact.trim() || undefined,
            clientEmail: clientEmail.trim() || undefined,
            clientPhone: clientPhone.trim() || undefined,
            startDate: startDate || undefined,
            estimatedCompletionDate: estimatedCompletionDate || undefined,
            createBudget,
            createSubcontracts,
            costCodeMappings: costCodeMappings.length > 0
              ? costCodeMappings
              : undefined,
          },
        }
      );
      setConversionResult(result);
      toast.success("Bid converted to project successfully!");
      setCurrentStep(5); // Move to success step
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to convert bid"
      );
    } finally {
      setIsConverting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{error || "Bid not found"}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/bids/${id}`}>Back to Bid</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (conversionResult) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Bids", href: "/bids" },
            { label: preview.bidName, href: `/bids/${id}` },
            { label: "Convert to Project" },
          ]}
        />

        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Conversion Complete</h2>
            <p className="text-muted-foreground">
              Bid <span className="font-mono">{preview.bidNumber}</span> has been
              converted to project{" "}
              <span className="font-mono font-medium">
                {conversionResult.projectNumber}
              </span>
            </p>
            <div className="rounded-lg border bg-muted/50 p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium">{conversionResult.projectName}</span>
              </div>
              {conversionResult.budgetId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium text-green-600">Created</span>
                </div>
              )}
              {conversionResult.subcontractsCreated > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subcontracts</span>
                  <span className="font-medium">
                    {conversionResult.subcontractsCreated} created
                  </span>
                </div>
              )}
              {conversionResult.costCodesMapped > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost codes</span>
                  <span className="font-medium">
                    {conversionResult.costCodesMapped} mapped
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link href="/bids">Back to Bids</Link>
              </Button>
              <Button
                asChild
                className="bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
              >
                <Link href={`/projects/${conversionResult.projectId}`}>
                  View Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subcontractorItems = preview.items.filter(
    (i) => i.category === "Subcontractor"
  );
  const canProceed =
    currentStep === 0 ||
    (currentStep === 1 && projectNumber.trim().length > 0) ||
    currentStep === 2 ||
    currentStep === 3;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Bids", href: "/bids" },
          { label: preview.bidName, href: `/bids/${id}` },
          { label: "Convert to Project" },
        ]}
      />

      <h1 className="text-2xl font-bold tracking-tight">
        Convert Bid to Project
      </h1>

      {/* Stepper */}
      <nav aria-label="Wizard steps">
        <ol className="flex items-center gap-2 overflow-x-auto pb-2">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <li
                key={step.label}
                className="flex items-center gap-2 flex-shrink-0"
              >
                {index > 0 && (
                  <div
                    className={`hidden sm:block w-8 h-px ${
                      isCompleted ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                  } ${index > currentStep ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Separator />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Review Bid */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review Bid Details</h2>
            <p className="text-sm text-muted-foreground">
              Review the bid information that will be used to create the project.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bid Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{preview.bidName}</span>
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-medium font-mono">
                      {preview.bidNumber}
                    </span>
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-medium font-mono">
                      {formatCurrency(preview.estimatedValue)}
                    </span>
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium">
                      {preview.owner || "Not set"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {preview.description || "No description provided."}
                  </p>
                </CardContent>
              </Card>
            </div>

            {preview.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Bid Items ({preview.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.unitCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold">
                        <TableCell colSpan={4} className="text-right">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            preview.items.reduce(
                              (sum, i) => sum + i.totalCost,
                              0
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Configure Project */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Configure Project</h2>
            <p className="text-sm text-muted-foreground">
              Set project details. Fields are pre-populated from the bid.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectNumber">
                      Project Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="projectNumber"
                      placeholder="PRJ-2026-001"
                      value={projectNumber}
                      onChange={(e) => setProjectNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      placeholder={preview.bidName}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Project description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectType">Project Type</Label>
                    <Select value={projectType} onValueChange={setProjectType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Client Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Client Name</Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientContact">Contact Person</Label>
                      <Input
                        id="clientContact"
                        value={clientContact}
                        onChange={(e) => setClientContact(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="clientEmail">Email</Label>
                        <Input
                          id="clientEmail"
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientPhone">Phone</Label>
                        <Input
                          id="clientPhone"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Location & Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">Zip</Label>
                        <Input
                          id="zipCode"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="completionDate">Est. Completion</Label>
                        <Input
                          id="completionDate"
                          type="date"
                          value={estimatedCompletionDate}
                          onChange={(e) =>
                            setEstimatedCompletionDate(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Map Cost Codes */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Map Cost Codes</h2>
            <p className="text-sm text-muted-foreground">
              Assign cost codes to bid items for budget tracking. Suggested codes
              are pre-filled based on item category.
            </p>

            {preview.items.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No bid items to map. You can skip this step.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bid Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Cost Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.items.map((item) => {
                        const mapping = costCodeMappings.find(
                          (m) => m.bidItemId === item.id
                        );
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(item.totalCost)}
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-32"
                                placeholder="e.g. 03-100"
                                value={mapping?.costCode || ""}
                                onChange={(e) =>
                                  updateCostCodeMapping(
                                    item.id,
                                    e.target.value
                                  )
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Subcontracts */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Budget & Subcontracts</h2>
            <p className="text-sm text-muted-foreground">
              Choose whether to create a project budget and subcontracts from
              bid items.
            </p>

            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="createBudget"
                      checked={createBudget}
                      onCheckedChange={(checked) =>
                        setCreateBudget(checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="createBudget" className="font-medium">
                        Create Project Budget
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Initialize the project budget with the bid value of{" "}
                        <span className="font-mono font-medium">
                          {formatCurrency(preview.estimatedValue)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="createSubcontracts"
                      checked={createSubcontracts}
                      onCheckedChange={(checked) =>
                        setCreateSubcontracts(checked === true)
                      }
                      disabled={subcontractorItems.length === 0}
                    />
                    <div>
                      <Label
                        htmlFor="createSubcontracts"
                        className="font-medium"
                      >
                        Create Subcontracts from Bid Items
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {subcontractorItems.length > 0
                          ? `Create ${subcontractorItems.length} subcontract(s) from subcontractor bid items`
                          : "No subcontractor items in this bid"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {createSubcontracts && subcontractorItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Subcontracts to Create
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subcontractor</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subcontractorItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.description}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              SC-{projectNumber || "PRJ"}-{String(index + 1).padStart(3, "0")}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(item.totalCost)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">Draft</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Confirm Conversion</h2>
            <p className="text-sm text-muted-foreground">
              Review the summary below and confirm the conversion.
            </p>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Source Bid
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{preview.bidName}</span>
                      <span className="text-muted-foreground">Number</span>
                      <span className="font-medium font-mono">
                        {preview.bidNumber}
                      </span>
                      <span className="text-muted-foreground">Value</span>
                      <span className="font-medium font-mono">
                        {formatCurrency(preview.estimatedValue)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      New Project
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">
                        {projectName || preview.bidName}
                      </span>
                      <span className="text-muted-foreground">Number</span>
                      <span className="font-medium font-mono">
                        {projectNumber}
                      </span>
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">
                        {PROJECT_TYPES.find((t) => t.value === projectType)
                          ?.label || "Commercial"}
                      </span>
                      {clientName && (
                        <>
                          <span className="text-muted-foreground">Client</span>
                          <span className="font-medium">{clientName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    >
                      Create Project
                    </Badge>
                    {createBudget && preview.items.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        Create Budget
                      </Badge>
                    )}
                    {costCodeMappings.filter((m) => m.costCode).length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        {costCodeMappings.filter((m) => m.costCode).length} Cost
                        Code Mapping(s)
                      </Badge>
                    )}
                    {createSubcontracts && subcontractorItems.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        {subcontractorItems.length} Subcontract(s)
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <Separator />
      <div className="flex justify-between">
        <div>
          {currentStep === 0 ? (
            <Button asChild variant="ghost" className="min-h-[44px]">
              <Link href={`/bids/${id}`}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Bid
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setCurrentStep((s) => s - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
          )}
        </div>
        <div>
          {currentStep < 4 ? (
            <Button
              className="min-h-[44px]"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <LoadingButton
              className="bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
              onClick={handleConvert}
              loading={isConverting}
              loadingText="Converting..."
            >
              Convert to Project
            </LoadingButton>
          )}
        </div>
      </div>
    </div>
  );
}
