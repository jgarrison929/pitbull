"use client";

import { useState } from "react";
import { Sparkles, Loader2, FileSearch, Calendar, DollarSign, Users, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import type { AiDocumentAnalysisResponse, AiDocumentAnalysis } from "@/lib/types";

interface AiDocumentAnalysisButtonProps {
  fileId: string;
  fileName: string;
}

/**
 * Button + panel that triggers AI analysis of a document.
 * Shows extracted dates, amounts, parties, and key terms.
 */
export function AiDocumentAnalysisButton({ fileId, fileName }: AiDocumentAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiDocumentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await api<AiDocumentAnalysisResponse>("/api/ai/analyze-document", {
        method: "POST",
        body: { fileId },
      });

      if (!result.analysis || typeof result.analysis !== "string") {
        setError("Received an invalid response from AI. Please try again.");
        return;
      }

      let parsed: AiDocumentAnalysis;
      try {
        parsed = JSON.parse(result.analysis) as AiDocumentAnalysis;
      } catch {
        setError("AI returned a malformed response. Please try again.");
        return;
      }

      // Validate response shape — ensure arrays exist to prevent render crashes
      parsed = {
        documentType: parsed.documentType ?? null,
        dates: Array.isArray(parsed.dates) ? parsed.dates : [],
        amounts: Array.isArray(parsed.amounts) ? parsed.amounts : [],
        parties: Array.isArray(parsed.parties) ? parsed.parties : [],
        keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
        summary: parsed.summary ?? null,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };

      setAnalysis(parsed);
    } catch {
      setError("Failed to analyze document. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis && !error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={isLoading}
        className="gap-1.5"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        )}
        {isLoading ? "Analyzing..." : "Analyze"}
      </Button>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
        <Button variant="ghost" size="sm" onClick={handleAnalyze} className="mt-2 text-xs">
          Retry
        </Button>
      </div>
    );
  }

  return <AnalysisResultPanel analysis={analysis!} fileName={fileName} />;
}

function AnalysisResultPanel({
  analysis,
  fileName,
}: {
  analysis: AiDocumentAnalysis;
  fileName: string;
}) {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSearch className="h-4 w-4 text-amber-500" />
          AI Analysis: {fileName}
        </CardTitle>
        {analysis.documentType && (
          <Badge variant="secondary" className="w-fit">{analysis.documentType}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {analysis.summary && (
          <p className="text-sm text-muted-foreground">{analysis.summary}</p>
        )}

        {/* Dates */}
        {analysis.dates.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-2">
              <Calendar className="h-3.5 w-3.5" /> Dates
            </h4>
            <div className="space-y-1">
              {analysis.dates.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amounts */}
        {analysis.amounts.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-2">
              <DollarSign className="h-3.5 w-3.5" /> Amounts
            </h4>
            <div className="space-y-1">
              {analysis.amounts.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="font-medium">
                    ${a.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parties */}
        {analysis.parties.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-2">
              <Users className="h-3.5 w-3.5" /> Parties
            </h4>
            <div className="space-y-1">
              {analysis.parties.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Terms */}
        {analysis.keyTerms.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground mb-2">
              <Tag className="h-3.5 w-3.5" /> Key Terms
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keyTerms.map((term, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Recommendations
            </h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-amber-500 shrink-0">*</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
