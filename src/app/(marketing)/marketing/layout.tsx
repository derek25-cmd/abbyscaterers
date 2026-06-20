import { MarketingNav } from "@/features/marketing/components/MarketingNav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Marketing & CRM
        </h1>
        <p className="text-muted-foreground">
          Track prospects, field visits, and follow-ups across the marketing team.
        </p>
      </div>

      <MarketingNav />

      <div className="p-4 bg-card rounded-lg shadow-sm border">
        {children}
      </div>
    </div>
  );
}
