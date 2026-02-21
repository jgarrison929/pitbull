"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import {
  WIDGET_DEFINITIONS,
  type WidgetConfig,
  type WidgetDefinition,
} from "./widgets";

interface CustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: WidgetConfig[];
  onAdd: (definition: WidgetDefinition) => void;
  onToggle: (widgetId: string, visible: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  metrics: "Metrics",
  activity: "Activity & Actions",
  projects: "Projects & RFIs",
  financial: "Financial",
};

export function CustomizeDialog({
  open,
  onOpenChange,
  widgets,
  onAdd,
  onToggle,
}: CustomizeDialogProps) {
  const [filter, setFilter] = useState<string | null>(null);

  const categories = ["metrics", "activity", "projects", "financial"];

  const filtered = filter
    ? WIDGET_DEFINITIONS.filter((d) => d.category === filter)
    : WIDGET_DEFINITIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Add, remove, or toggle widgets on your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
            className="min-h-[36px]"
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={filter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(cat)}
              className="min-h-[36px]"
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {filtered.map((definition) => {
            const existing = widgets.find((w) => w.type === definition.type);
            const isAdded = !!existing;
            const isVisible = existing?.visible ?? false;
            const Icon = definition.icon;

            return (
              <div
                key={definition.type}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{definition.label}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {definition.defaultSize}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {definition.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {isAdded ? (
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) =>
                        onToggle(existing!.id, checked)
                      }
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAdd(definition)}
                      className="min-h-[36px]"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
