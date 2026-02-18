"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { BidStatus, type Bid, type UpdateBidCommand } from "@/lib/types";
import { toast } from "sonner";

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_NOTES_LENGTH = 500;

export default function EditBidPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [bid, setBid] = useState<Bid | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [bidDate, setBidDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<BidStatus>(BidStatus.Draft);

  useEffect(() => {
    async function loadBid() {
      setIsLoading(true);
      try {
        const data = await api<Bid>(`/api/bids/${id}`);
        setBid(data);
        setNumber(data.number ?? "");
        setName(data.name ?? "");
        setOwner(data.owner ?? "");
        setDescription(data.description ?? "");
        setNotes(data.notes ?? "");
        setEstimatedValue(data.estimatedValue?.toString() ?? "0");
        setBidDate(data.bidDate?.slice(0, 10) ?? "");
        setDueDate(data.dueDate?.slice(0, 10) ?? "");
        setStatus(data.status);
      } catch {
        toast.error("Failed to load bid");
      } finally {
        setIsLoading(false);
      }
    }

    loadBid();
  }, [id]);

  async function handleSave() {
    if (!number.trim() || !name.trim()) {
      toast.error("Bid number and name are required");
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      toast.error(`Name must be ${MAX_NAME_LENGTH} characters or less`);
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
      return;
    }
    if (notes.length > MAX_NOTES_LENGTH) {
      toast.error(`Notes must be ${MAX_NOTES_LENGTH} characters or less`);
      return;
    }
    if (estimatedValue && (isNaN(Number(estimatedValue)) || Number(estimatedValue) < 0)) {
      toast.error("Estimated value must be 0 or greater");
      return;
    }
    if (bidDate && dueDate && bidDate > dueDate) {
      toast.error("Due date must be on or after bid date");
      return;
    }

    setIsSaving(true);
    try {
      const command: UpdateBidCommand = {
        id,
        name: name.trim(),
        number: number.trim(),
        status,
        estimatedValue: Number(estimatedValue || 0),
        bidDate: bidDate || undefined,
        dueDate: dueDate || undefined,
        owner: owner.trim() || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        items: bid?.items?.map((item) => ({
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      };

      const updated = await api<Bid>(`/api/bids/${id}`, {
        method: "PUT",
        body: command,
      });
      toast.success("Bid updated");
      router.push(`/bids/${updated.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bid");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Bids", href: "/bids" },
            { label: "Edit" },
          ]}
        />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Bids", href: "/bids" },
          { label: bid?.name || "Bid", href: `/bids/${id}` },
          { label: "Edit" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Edit Bid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="number">Bid Number</Label>
              <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as BidStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BidStatus.Draft}>Draft</SelectItem>
                  <SelectItem value={BidStatus.Submitted}>Submitted</SelectItem>
                  <SelectItem value={BidStatus.Won}>Won</SelectItem>
                  <SelectItem value={BidStatus.Lost}>Lost</SelectItem>
                  <SelectItem value={BidStatus.NoResponse}>No Response</SelectItem>
                  <SelectItem value={BidStatus.Cancelled}>Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Bid Name</Label>
            <Input id="name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="owner">Client / Owner</Label>
              <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedValue">Estimated Value</Label>
              <Input
                id="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bidDate">Bid Date</Label>
              <Input id="bidDate" type="date" value={bidDate} onChange={(e) => setBidDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} maxLength={MAX_DESCRIPTION_LENGTH} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} maxLength={MAX_NOTES_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" disabled={isSaving}>
              <Link href={`/bids/${id}`}>Cancel</Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
