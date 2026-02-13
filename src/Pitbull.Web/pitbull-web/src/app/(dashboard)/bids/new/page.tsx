"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField, TextareaField } from "@/components/ui/form-field";
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
import type { Bid, CreateBidCommand, BidStatus } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FormErrors = Partial<
  Record<"bidNumber" | "name" | "estimatedValue" | "dates", string>
>;

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_NOTES_LENGTH = 500;

export default function NewBidPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<BidStatus>("Draft");

  // Controlled form fields for validation
  const [bidNumber, setBidNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [bidDate, setBidDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Mark field as touched on blur
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Validate a single field
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
        if (value && (isNaN(Number(value)) || Number(value) < 0)) {
          return "Bid value must be 0 or greater";
        }
        break;
    }
    return undefined;
  }, []);

  // Validate dates together
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

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!bidNumber.trim()) return false;
    if (!name.trim()) return false;
    if (name.length > MAX_NAME_LENGTH) return false;
    if (description.length > MAX_DESCRIPTION_LENGTH) return false;
    if (notes.length > MAX_NOTES_LENGTH) return false;
    if (estimatedValue && (isNaN(Number(estimatedValue)) || Number(estimatedValue) < 0)) return false;
    if (validateDates()) return false;
    return true;
  }, [bidNumber, name, description, notes, estimatedValue, validateDates]);

  // Update errors when fields change (only for touched fields)
  const updateFieldError = useCallback((field: keyof FormErrors, value: string) => {
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
    }
  }, [touched, validateField]);

  // Validate all fields on submit
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      bidNumber: true,
      name: true,
      estimatedValue: true,
      dates: true,
    });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const command: CreateBidCommand = {
      bidNumber,
      name,
      description: description || undefined,
      status,
      clientName: (formData.get("clientName") as string) || undefined,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      bidDate: bidDate || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
    };

    try {
      const bid = await api<Bid>("/api/bids", {
        method: "POST",
        body: command,
      });
      toast.success("Bid created successfully");
      router.push(`/bids/${bid.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create bid"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Bid</h1>
        <p className="text-muted-foreground">Create a new bid proposal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bid Details</CardTitle>
          <CardDescription>
            Enter the information for this bid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
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
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as BidStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
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
                placeholder="0.00"
                min={0}
                step={0.01}
                value={estimatedValue}
                onChange={(e) => {
                  setEstimatedValue(e.target.value);
                  updateFieldError("estimatedValue", e.target.value);
                }}
                onBlur={() => handleBlur("estimatedValue")}
                error={touched.estimatedValue ? errors.estimatedValue : undefined}
              />
              <div className="space-y-2">
                <Label htmlFor="clientName">Client / Owner</Label>
                <Input
                  id="clientName"
                  name="clientName"
                  placeholder="Client name"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bidDate">Bid Date</Label>
                <Input 
                  id="bidDate" 
                  name="bidDate" 
                  type="date"
                  value={bidDate}
                  onChange={(e) => setBidDate(e.target.value)}
                  onBlur={() => handleBlur("dates")}
                  className={cn(touched.dates && errors.dates && "border-destructive")}
                  aria-invalid={!!(touched.dates && errors.dates)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate" 
                  name="dueDate" 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => handleBlur("dates")}
                  className={cn(touched.dates && errors.dates && "border-destructive")}
                  aria-invalid={!!(touched.dates && errors.dates)}
                />
              </div>
            </div>

            {touched.dates && errors.dates && (
              <p className="text-sm text-destructive" role="alert">{errors.dates}</p>
            )}

            <TextareaField
              label="Notes"
              name="notes"
              placeholder="Any additional notes..."
              rows={2}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
        </CardContent>
      </Card>
    </div>
  );
}
