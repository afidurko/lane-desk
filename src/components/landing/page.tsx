import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { InvoiceCheck } from "@/components/lookup/invoice-check";
import { YearLookup } from "@/components/lookup/year-lookup";
import { Shell } from "./shell";

export function LandingPage() {
  const [sheet, setSheet] = useState<string | null>(null);
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-6">
        <div key={sheet ?? "home"} className="rise">
        <p className="text-sm text-muted">{sheet ?? "Olean, New York"}</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
          {sheet ? "The difference." : "Bring the sheet."}
        </h1>
        {sheet ? null : <p className="mt-3 max-w-md text-base leading-relaxed text-muted">Lane puts their amount next to the posted file. You see the difference. Nothing is sent.</p>}
        </div>
        <div className="mt-8">
          <InvoiceCheck onOpen={setSheet} />
        </div>
        {sheet ? null : (
          <details className="mt-8 overflow-hidden rounded-[10px] bg-paper-2">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[17px] text-ink">
              Look up one code
              <ChevronRight className="size-4 text-muted" />
            </summary>
            <div className="px-4 pb-4">
              <YearLookup />
            </div>
          </details>
        )}
      </main>
    </Shell>
  );
}