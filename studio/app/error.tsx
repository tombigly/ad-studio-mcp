"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-8 space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-destructive">
            Something went wrong
          </h1>
          <p className="text-base text-foreground leading-relaxed">
            {error.message || "An unexpected error occurred while rendering this page."}
          </p>
          {error.digest && (
            <p className="text-xs text-foreground/60 font-mono">
              digest: {error.digest}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
