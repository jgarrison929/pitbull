import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home, Search } from "lucide-react";

/**
 * 404 page within the dashboard layout.
 * The sidebar and header remain visible — only the content area shows this.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileQuestion className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-4xl font-bold text-amber-500/80">404</p>
            <h1 className="text-xl font-semibold">Page not found</h1>
            <p className="text-sm text-muted-foreground">
              This page doesn&apos;t exist or may have been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
