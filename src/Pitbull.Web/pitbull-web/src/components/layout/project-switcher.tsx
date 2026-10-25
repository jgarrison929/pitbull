"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FolderOpen, HardHat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecentProjects } from "@/hooks/use-recent-projects";
import { cn } from "@/lib/utils";

/**
 * Quick project switcher dropdown for the sidebar.
 * Shows the current project (if on a project page) and recent projects.
 */
export function ProjectSwitcher() {
  const pathname = usePathname();
  const { recentProjects } = useRecentProjects();

  // Extract current project ID from URL if on a project page
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] || null;

  // Find current project in recent list
  const currentProject = currentProjectId
    ? recentProjects.find((p) => p.id === currentProjectId)
    : null;

  // Recent projects excluding current
  const otherRecentProjects = recentProjects.filter(
    (p) => p.id !== currentProjectId
  );

  // Don't show if no recent projects at all
  if (recentProjects.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-neutral-300 hover:bg-white/5 hover:text-white",
            "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          )}
        >
          <HardHat className="h-4 w-4 text-amber-400" />
          <span className="flex-1 text-left truncate">
            {currentProject ? currentProject.name : "Quick Switch"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-64 bg-[#1a1a2e] border-white/10 text-white"
      >
        {currentProject && (
          <>
            <DropdownMenuLabel className="text-neutral-400 text-xs uppercase tracking-wider">
              Current Project
            </DropdownMenuLabel>
            <DropdownMenuItem asChild className="focus:bg-amber-500/15 focus:text-amber-400">
              <Link href={`/projects/${currentProject.id}`} className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{currentProject.name}</span>
                <span className="text-xs text-neutral-500 font-mono">
                  {currentProject.number}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}

        {otherRecentProjects.length > 0 && (
          <>
            <DropdownMenuLabel className="text-neutral-400 text-xs uppercase tracking-wider">
              Recent Projects
            </DropdownMenuLabel>
            {otherRecentProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                asChild
                className="focus:bg-amber-500/15 focus:text-amber-400"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium truncate w-full">
                    {project.name}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {project.number}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}

        <DropdownMenuItem asChild className="focus:bg-white/5">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-neutral-300"
          >
            <FolderOpen className="h-4 w-4" />
            View All Projects
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
