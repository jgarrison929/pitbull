"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormField, TextareaField } from "@/components/ui/form-field";
import { SmartField } from "@/components/ui/smart-field";
import { FormSection } from "@/components/ui/form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { BidStatus, type Bid, type CreateBidCommand, type CreateBidItemDto, type BidItemCategory } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
  Info,
  List,
  Upload,
  Clock,
  Plus,
  Trash2,
  Calculator,
  Save,
  AlertTriangle,
} from "lucide-react";

type FormErrors = Partial<
  Record<"bidNumber" | "name" | "estimatedValue" | "dates", string>
>;

interface BidLineItem {
  id: string;
  description: string;
  category: BidItemCategory;
  quantity: number;
  unitCost: number;
}

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_NOTES_LENGTH = 500;

const CATEGORY_OPTIONS: { label: string; value: BidItemCategory }[] = [
  { label: "General", value: "General" },
  { label: "Sitework", value: "Sitework" },
  { label: "Concrete", value: "Concrete" },
  { label: "Masonry", value: "Masonry" },
  { label: "Metals", value: "Metals" },
  { label: "Wood/Plastics", value: "WoodPlastics" },
  { label: "Thermal/Moisture", value: "ThermalMoisture" },
  { label: "Doors/Windows", value: "DoorsWindows" },
  { label: "Finishes", value: "Finishes" },
  { label: "Specialties", value: "Specialties" },
  { label: "Equipment", value: "Equipment" },
  { label: "Mechanical", value: "Mechanical" },
  { label: "Electrical", value: "Electrical" },
  { label: "Other", value: "Other" },
];

function getDueDateUrgency(dueDate: string): { label: string; color: string; daysLeft: number } | null {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: `${Math.abs(daysLeft)} days overdue`, color: "text-red-600 bg-red-50 dark:bg-red-900/20", daysLeft };
  if (daysLeft === 0) return { label: "Due today!", color: "text-red-600 bg-red-50 dark:bg-red-900/20", daysLeft };
  if (daysLeft <= 3) return { label: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20", daysLeft };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", daysLeft };
  return { label: `${daysLeft} days left`, color: "text-green-600 bg-green-50 dark:bg-green-900/20", daysLeft };
}

export default function NewBidPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<BidStatus>(BidStatus.Draft);

  // Controlled form fields
  const [bidNumber, setBidNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [bidDate, setBidDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Bid line items
  const [lineItems, setLineItems] = useState<BidLineItem[]>([]);

  // Markup calculator
  const [markupPercent, setMarkupPercent] = useState("10");
  const [showMarkup, setShowMarkup] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  // Auto-save draft
  const formDataForSave = useMemo(() => ({
    bidNumber, name, description, estimatedValue, clientName, notes, bidDate, dueDate, status,
  }), [bidNumber, name, description, estimatedValue, clientName, notes, bidDate, dueDate, status]);

  const { loadDraft, clearDraft } = useFormAutosave("bid-new", formDataForSave, {
    enabled: isDirty,
  });

  // Load draft on mount
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (draftLoaded) return;
    setDraftLoaded(true);
    const draft = loadDraft();
    if (draft) {
      const ago = new Date().getTime() - new Date(draft.savedAt).getTime();
      const minsAgo = Math.floor(ago / 60000);
      if (minsAgo < 60 * 24) {
        toast.info(`Draft restored from ${minsAgo < 1 ? "just now" : `${minsAgo}m ago`}`, {
          action: {
            label: "Discard",
            onClick: () => {
              clearDraft();
              window.location.reload();
            },
          },
        });
        const d = draft.data;
        if (d.bidNumber) setBidNumber(d.bidNumber);
        if (d.name) setName(d.name);
        if (d.description) setDescription(d.description);
        if (d.estimatedValue) setEstimatedValue(d.estimatedValue);
        if (d.clientName) setClientName(d.clientName);
        if (d.notes) setNotes(d.notes);
        if (d.bidDate) setBidDate(d.bidDate);
        if (d.dueDate) setDueDate(d.dueDate);
        if (d.status) setStatus(d.status as BidStatus);
      }
    }
  }, [draftLoaded, loadDraft, clearDraft]);

  useEffect(() => {
    if (bidNumber || name || description) setIsDirty(true);
  }, [bidNumber, name, description]);

  // Running total from line items
  const lineItemTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }, [lineItems]);

  const markupAmount = useMemo(() => {
    const pct = parseFloat(markupPercent) || 0;
    return lineItemTotal * (pct / 100);
  }, [lineItemTotal, markupPercent]);

  const totalWithMarkup = lineItemTotal + markupAmount;

  // Due date urgency
  const urgency = getDueDateUrgency(dueDate);

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case "bidNumber":
        if (!value.trim()) return "Bid number is required";
        break;
      case "name":
        if (!value.trim()) return "Bid name is required";
        if (value.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or less`;
        break;
      case "estimatedValue":
        if (value && (isNaN(Number(value)) || Number(value) < 0)) return "Bid value must be 0 or greater";
        break;
    }
    return undefined;
  }, []);

  const validateDates = useCallback((): string | undefined => {
    if (bidDate && dueDate) {
      const bid = new Date(bidDate);
      const due = new Date(dueDate);
      if (!isNaN(bid.getTime()) && !isNaN(due.getTime()) && due < bid) {
        return "Due date must be on or after bid date";
      }
    }
    return undefined;
  }, [bidDate, dueDate]);

  const isFormValid = useMemo(() => {
    if (!bidNumber.trim() || !name.trim()) return false;
    if (name.length > MAX_NAME_LENGTH) return false;
    if (description.length > MAX_DESCRIPTION_LENGTH) return false;
    if (notes.length > MAX_NOTES_LENGTH) return false;
    if (estimatedValue && (isNaN(Number(estimatedValue)) || Number(estimatedValue) < 0)) return false;
    if (validateDates()) return false;
    return true;
  }, [bidNumber, name, description, notes, estimatedValue, validateDates]);

  const updateFieldError = useCallback((field: keyof FormErrors, value: string) => {
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      });
    }
  }, [touched, validateField]);

  function validateAll(): FormErrors {
    const next: FormErrors = {};
    const bidNumberError = validateField("bidNumber", bidNumber);
    if (bidNumberError) next.bidNumber = bidNumberError;
    const nameError = validateField("name", name);
    if (nameError) next.name = nameError;
    const valueError = validateField("estimatedValue", estimatedValue);
    if (valueError) next.estimatedValue = valueError;
    const datesError = validateDates();
    if (datesError) next.dates = datesError;
    return next;
  }

  // Line item management
  function addLineItem() {
    setLineItems(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "",
        category: "General",
        quantity: 1,
        unitCost: 0,
      },
    ]);
  }

  function updateLineItem(id: string, field: keyof BidLineItem, value: string | number) {
    setLineItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function removeLineItem(id: string) {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ bidNumber: true, name: true, estimatedValue: true, dates: true });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const command: CreateBidCommand = {
      name,
      number: bidNumber,
      status: BidStatus.Draft,
      estimatedValue: estimatedValue ? Number(estimatedValue) : (totalWithMarkup > 0 ? totalWithMarkup : 0),
      bidDate: bidDate || undefined,
      dueDate: dueDate || undefined,
      owner: clientName || undefined,
      description: description || undefined,
      notes: notes || undefined,
      items: lineItems.length > 0 ? lineItems.map(item => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })) : undefined,
    };

    try {
      const bid = await api<Bid>("/api/bids", { method: "POST", body: command });
      clearDraft();
      setIsDirty(false);
      toast.success("Bid created successfully");
      router.push(`/bids/${bid.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bid");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Bid</h1>
          <p className="text-muted-foreground">Create a new bid proposal</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="secondary" className="gap-1 text-xs animate-in fade-in-50">
              <Save className="h-3 w-3" />
              Draft auto-saved
            </Badge>
          )}
          {urgency && (
            <Badge variant="secondary" className={cn("gap-1 text-xs", urgency.color)}>
              <Clock className="h-3 w-3" />
              {urgency.label}
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isSubmitting} className="space-y-4">

          {/* Section 1: Bid Info */}
          <FormSection
            title="Bid Information"
            description="Basic details, client, and dates"
            icon={<Info className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Bid Number"
                  name="bidNumber"
                  placeholder="B-2024-015"
                  required
                  value={bidNumber}
                  onChange={(e) => {
                    setBidNumber(e.target.value);
                    updateFieldError("bidNumber", e.target.value);
                  }}
                  onBlur={() => handleBlur("bidNumber")}
                  error={touched.bidNumber ? errors.bidNumber : undefined}
                />
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as BidStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FormField
                label="Bid Name / Project"
                name="name"
                placeholder="e.g. City Hall HVAC Upgrade"
                required
                maxLength={MAX_NAME_LENGTH}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  updateFieldError("name", e.target.value);
                }}
                onBlur={() => handleBlur("name")}
                error={touched.name ? errors.name : undefined}
              />

              <TextareaField
                label="Scope of Work"
                name="description"
                placeholder="Describe the scope of work for this bid..."
                rows={3}
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Bid Value ($)"
                  name="estimatedValue"
                  type="number"
                  placeholder={totalWithMarkup > 0 ? `Calculated: $${totalWithMarkup.toLocaleString()}` : "0.00"}
                  min={0}
                  step={0.01}
                  value={estimatedValue}
                  onChange={(e) => {
                    setEstimatedValue(e.target.value);
                    updateFieldError("estimatedValue", e.target.value);
                  }}
                  onBlur={() => handleBlur("estimatedValue")}
                  error={touched.estimatedValue ? errors.estimatedValue : undefined}
                  helpText={lineItemTotal > 0 ? `Line items total: $${lineItemTotal.toLocaleString()}` : undefined}
                />
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client / Owner</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client name"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bidDate">Bid Date</Label>
                  <Input
                    id="bidDate"
                    type="date"
                    value={bidDate}
                    onChange={(e) => setBidDate(e.target.value)}
                    onBlur={() => handleBlur("dates")}
                    className={cn(touched.dates && errors.dates && "border-destructive")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="flex items-center gap-2">
                    Due Date
                    {urgency && urgency.daysLeft <= 3 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onBlur={() => handleBlur("dates")}
                    className={cn(
                      touched.dates && errors.dates && "border-destructive",
                      urgency && urgency.daysLeft <= 3 && "border-amber-400"
                    )}
                  />
                  {urgency && (
                    <p className={cn("text-xs font-medium", urgency.daysLeft < 0 ? "text-red-600" : urgency.daysLeft <= 3 ? "text-amber-600" : "text-muted-foreground")}>
                      {urgency.label}
                    </p>
                  )}
                </div>
              </div>

              {touched.dates && errors.dates && (
                <p className="text-sm text-destructive" role="alert">{errors.dates}</p>
              )}

              <SmartField
                label="Notes"
                fieldName="notes"
                entityType="bid"
                placeholder="Any additional notes..."
                rows={2}
                value={notes}
                onChange={setNotes}
                context={{ bidName: name || "", scope: description || "" }}
              />
            </div>
          </FormSection>

          {/* Section 2: Bid Items Grid */}
          <FormSection
            title="Bid Items"
            description="Line-item breakdown with running totals"
            icon={<List className="h-4 w-4" />}
            defaultOpen={false}
            badge={
              lineItems.length > 0 ? (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                </Badge>
              ) : null
            }
          >
            <div className="space-y-4">
              {/* Header row */}
              {lineItems.length > 0 && (
                <div className="hidden sm:grid sm:grid-cols-[1fr_120px_80px_100px_80px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Description</span>
                  <span>Category</span>
                  <span>Qty</span>
                  <span>Unit Cost</span>
                  <span>Total</span>
                  <span></span>
                </div>
              )}

              {/* Line items */}
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-2 sm:grid-cols-[1fr_120px_80px_100px_80px_40px] items-start rounded-md border bg-accent/10 p-2 animate-in fade-in-50 slide-in-from-top-1"
                >
                  <Input
                    placeholder={`Item ${index + 1} description`}
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                    className="text-sm"
                  />
                  <Select
                    value={item.category}
                    onValueChange={(v) => updateLineItem(item.id, "category", v)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity || ""}
                    onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value) || 0)}
                    className="text-sm text-right"
                    placeholder="Qty"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitCost || ""}
                    onChange={(e) => updateLineItem(item.id, "unitCost", Number(e.target.value) || 0)}
                    className="text-sm text-right"
                    placeholder="$0.00"
                  />
                  <div className="flex items-center h-9 text-sm font-medium text-right pr-1">
                    ${(item.quantity * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLineItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
                <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" disabled>
                  <Upload className="h-3.5 w-3.5" />
                  Import from CSV
                </Button>
              </div>

              {/* Running totals */}
              {lineItems.length > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({lineItems.length} items)</span>
                    <span className="font-medium">${lineItemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {/* Markup calculator */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowMarkup(!showMarkup)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        Markup
                      </button>
                      {showMarkup && (
                        <div className="flex items-center gap-1 animate-in fade-in-50">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={markupPercent}
                            onChange={(e) => setMarkupPercent(e.target.value)}
                            className="h-7 w-16 text-xs text-right"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                    </div>
                    {showMarkup && (
                      <span className="font-medium">
                        +${markupAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-amber-600">
                      ${totalWithMarkup.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </FormSection>
        </fieldset>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <LoadingButton
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] disabled:opacity-50"
            loading={isSubmitting}
            loadingText="Creating..."
            disabled={!isFormValid}
          >
            Create Bid
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

function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-t", className)} />;
}
