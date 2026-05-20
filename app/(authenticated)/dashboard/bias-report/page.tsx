// Bias Report page — placeholder for Phase 4.
// Will show disposition effect, revenge trading Markov analysis, and FOMO P&L.
import { Brain } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BiasReportPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bias Report</h1>
        <p className="text-sm text-muted-foreground">
          Weekly analysis of your behavioral patterns
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Disposition Effect",
            desc: "How much longer you hold losers vs winners",
          },
          {
            title: "Revenge Trading",
            desc: "Win-rate drop after a loss within 60 minutes",
          },
          {
            title: "FOMO (Social Proof)",
            desc: "P&L of tips-driven trades vs other strategies",
          },
        ].map(({ title, desc }) => (
          <Card key={title} className="border-dashed opacity-60">
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{desc}</p>
              <p className="mt-2 text-xs text-muted-foreground italic">
                Coming in Phase 4
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Brain className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground max-w-sm">
          Log and close a few trades first. Phase 4 will wire up the Markov math and
          AI narrative once you have data to analyze.
        </p>
      </div>
    </div>
  )
}
