"use client";

import { useState } from "react";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/skeletons";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Download,
  Settings,
  Search,
  FileText,
  ArrowUpDown,
  AlertCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function ComponentsShowcasePage() {
  const { isAdmin } = useRequireAdmin();
  const [loadingBtn, setLoadingBtn] = useState(false);

  if (!isAdmin) return null;

  function handleLoadingDemo() {
    setLoadingBtn(true);
    setTimeout(() => setLoadingBtn(false), 2000);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin/users" },
          { label: "Component Showcase" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Component Showcase
        </h1>
        <p className="text-muted-foreground">
          Reference of UI components used throughout Pitbull. Useful for
          designers, developers, and demos.
        </p>
      </div>

      <Tabs defaultValue="buttons" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="buttons">Buttons</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="empty">Empty States</TabsTrigger>
          <TabsTrigger value="skeletons">Skeletons</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="dialogs">Dialogs</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        {/* === BUTTONS === */}
        <TabsContent value="buttons">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>
                All button variants, sizes, and states.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="default">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon">
                    <Plus />
                  </Button>
                  <Button size="icon-sm" variant="outline">
                    <Settings />
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">With Icons</h3>
                <div className="flex flex-wrap gap-3">
                  <Button>
                    <Plus /> Create Project
                  </Button>
                  <Button variant="destructive">
                    <Trash2 /> Delete
                  </Button>
                  <Button variant="outline">
                    <Download /> Export CSV
                  </Button>
                  <Button variant="ghost">
                    <Search /> Search
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">States</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled>Disabled</Button>
                  <LoadingButton
                    loading={loadingBtn}
                    loadingText="Saving..."
                    onClick={handleLoadingDemo}
                  >
                    Click to Load
                  </LoadingButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CARDS === */}
        <TabsContent value="cards">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
                <CardDescription>
                  A simple card with header and content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cards are used throughout the app for grouping related content
                  like project details, bid summaries, and settings panels.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>KPI Card</CardTitle>
                <CardDescription>Active Projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">24</div>
                <p className="text-sm text-muted-foreground mt-1">
                  +3 from last month
                </p>
                <Progress value={72} className="mt-3 h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card with Footer</CardTitle>
                <CardDescription>
                  Includes action buttons at the bottom.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Footer cards are used for forms and confirmation panels where
                  the user needs to take action.
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
                <Button size="sm">Save Changes</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* === TABLES === */}
        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Data Table</CardTitle>
              <CardDescription>
                Standard table with sortable headers and status badges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none">
                      <span className="inline-flex items-center gap-1">
                        Project <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="cursor-pointer select-none">
                      <span className="inline-flex items-center gap-1">
                        Budget <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      Downtown Office Tower
                    </TableCell>
                    <TableCell>Meridian Properties</TableCell>
                    <TableCell>$2,450,000</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Riverside Apartments
                    </TableCell>
                    <TableCell>Harbor Development</TableCell>
                    <TableCell>$1,800,000</TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Bidding
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Medical Center Renovation
                    </TableCell>
                    <TableCell>St. Mary&apos;s Health</TableCell>
                    <TableCell>$950,000</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Planning
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Warehouse Expansion
                    </TableCell>
                    <TableCell>LogiCorp Inc.</TableCell>
                    <TableCell>$3,200,000</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Completed</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>Showing 1-4 of 24 projects</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === BADGES === */}
        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>
                Status indicators and labels used across the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Base Variants</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">Project Statuses</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Planning
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    On Hold
                  </Badge>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Over Budget
                  </Badge>
                  <Badge variant="secondary">Completed</Badge>
                  <Badge variant="outline">Draft</Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">
                  Approval Statuses
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    Pending
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Approved
                  </Badge>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Rejected
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">Roles</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Admin</Badge>
                  <Badge variant="secondary">Manager</Badge>
                  <Badge variant="outline">Supervisor</Badge>
                  <Badge variant="outline">User</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === EMPTY STATES === */}
        <TabsContent value="empty">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>With Action Link</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={FileText}
                  title="No projects yet"
                  description="Create your first project to start tracking budgets, schedules, and costs."
                  actionLabel="Create Project"
                  actionHref="/projects/new"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>With Action Callback</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description="Try adjusting your search terms or filters to find what you're looking for."
                  actionLabel="Clear Filters"
                  onAction={() => toast.info("Filters cleared")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === SKELETONS === */}
        <TabsContent value="skeletons">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Primitive Skeletons</CardTitle>
                <CardDescription>
                  Building blocks for loading states.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <TableSkeleton
              title="Table Skeleton"
              headers={["Project", "Client", "Budget", "Status"]}
              rows={3}
            />
          </div>
        </TabsContent>

        {/* === FORMS === */}
        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>Form Inputs</CardTitle>
              <CardDescription>
                Standard form controls used in create/edit views.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. Downtown Office Tower"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-search">Search with Icon</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="project-search"
                      placeholder="Search projects..."
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status-select">Status</Label>
                  <Select>
                    <SelectTrigger className="w-full" id="status-select">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input id="start-date" type="date" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter project description..."
                    rows={3}
                  />
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Checkbox id="terms" />
                  <Label htmlFor="terms" className="text-sm font-normal">
                    I agree to the terms and conditions
                  </Label>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications" className="text-sm">
                    Enable email notifications
                  </Label>
                  <Switch id="notifications" />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Progress</Label>
                  <Progress value={65} className="h-2" />
                  <p className="text-xs text-muted-foreground">65% complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === DIALOGS === */}
        <TabsContent value="dialogs">
          <Card>
            <CardHeader>
              <CardTitle>Dialogs</CardTitle>
              <CardDescription>
                Modal dialogs for confirmations and forms.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open Confirmation</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Delete Project?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete &quot;Downtown Office
                      Tower&quot; and all associated data. This action cannot be
                      undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter showCloseButton>
                    <Button variant="destructive">Delete Project</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Form Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Invite a new team member to this project.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="dialog-email">Email</Label>
                      <Input
                        id="dialog-email"
                        type="email"
                        placeholder="name@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dialog-role">Role</Label>
                      <Select>
                        <SelectTrigger className="w-full" id="dialog-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter showCloseButton>
                    <Button>Send Invite</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === FEEDBACK === */}
        <TabsContent value="feedback">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toast Notifications</CardTitle>
                <CardDescription>
                  Trigger toast messages with different severity levels.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => toast.success("Project created successfully")}
                >
                  <CheckCircle2 className="text-green-500" /> Success
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.error("Failed to save — check required fields")
                  }
                >
                  <AlertCircle className="text-red-500" /> Error
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.warning("Budget threshold exceeded (90%)")
                  }
                >
                  <AlertTriangle className="text-amber-500" /> Warning
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.info("3 time entries pending approval")}
                >
                  <Info className="text-blue-500" /> Info
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>
                  Inline alert banners for contextual messages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Information</AlertTitle>
                  <AlertDescription>
                    Time entries for this pay period are due by Friday 5:00 PM.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Budget overrun detected on Phase 3. Review cost allocations
                    immediately.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
