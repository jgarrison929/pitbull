"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
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
import type { Rfi, CreateRfiCommand, RfiPriority, Project, PagedResult } from "@/lib/types";
import { toast } from "sonner";

export default function NewRfiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [priority, setPriority] = useState<RfiPriority>(1); // Normal

  useEffect(() => {
    async function fetchProjects() {
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=100"
        );
        setProjects(result.items);
        // If no initial project, select first
        if (!initialProjectId && result.items.length > 0) {
          setSelectedProjectId(result.items[0].id);
        }
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [initialProjectId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const command: CreateRfiCommand = {
      subject: formData.get("subject") as string,
      question: formData.get("question") as string,
      priority,
      dueDate: (formData.get("dueDate") as string) || undefined,
      ballInCourtName: (formData.get("ballInCourtName") as string) || undefined,
      assignedToName: (formData.get("assignedToName") as string) || undefined,
      createdByName: (formData.get("createdByName") as string) || undefined,
    };

    try {
      const rfi = await api<Rfi>(
        `/api/projects/${selectedProjectId}/rfis`,
        {
          method: "POST",
          body: command,
        }
      );
      toast.success("RFI created successfully");
      router.push(`/rfis/${rfi.id}?projectId=${selectedProjectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create RFI");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New RFI</h1>
        <p className="text-muted-foreground">
          Create a new Request for Information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFI Details</CardTitle>
          <CardDescription>
            Enter the information for this RFI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset
              disabled={isSubmitting || isLoadingProjects}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.number} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProject && (
                  <p className="text-xs text-muted-foreground">
                    RFI will be added to: {selectedProject.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="e.g. Foundation Depth Clarification"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Textarea
                  id="question"
                  name="question"
                  placeholder="Describe what you need clarification on..."
                  rows={5}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={String(priority)}
                    onValueChange={(v) => setPriority(Number(v) as RfiPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Low</SelectItem>
                      <SelectItem value="1">Normal</SelectItem>
                      <SelectItem value="2">High</SelectItem>
                      <SelectItem value="3">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ballInCourtName">Ball In Court</Label>
                  <Input
                    id="ballInCourtName"
                    name="ballInCourtName"
                    placeholder="Who needs to take action?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedToName">Assigned To</Label>
                  <Input
                    id="assignedToName"
                    name="assignedToName"
                    placeholder="Who should respond?"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="createdByName">Created By</Label>
                <Input
                  id="createdByName"
                  name="createdByName"
                  placeholder="Your name"
                />
              </div>
            </fieldset>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <LoadingButton
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                loading={isSubmitting}
                loadingText="Creating..."
                disabled={!selectedProjectId}
              >
                Create RFI
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
