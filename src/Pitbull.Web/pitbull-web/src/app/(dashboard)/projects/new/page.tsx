"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Call API to create project
    // const formData = new FormData(e.currentTarget);
    // await api("/api/projects", { method: "POST", body: Object.fromEntries(formData) });

    setTimeout(() => {
      router.push("/projects");
    }, 500);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">Create a new construction project</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Enter the basic information for this project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="number">Project Number</Label>
                <Input id="number" name="number" placeholder="P-2024-006" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue="Planning">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input id="name" name="name" placeholder="e.g. Downtown Office Complex" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the project scope..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" name="budget" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm">Project Manager</Label>
                <Input id="pm" name="projectManagerId" placeholder="Select PM" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
