import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignOutButton } from '@/components/sign-out-button';

interface AreaPlaceholderProps {
  title: string;
  phase: string;
  summary: string;
  planned: string[];
  signedInAs: string | null;
  footer?: ReactNode;
}

/** Phase 1 stand-in for an area of the app: says what will be built here. */
export function AreaPlaceholder({ title, phase, summary, planned, signedInAs, footer }: AreaPlaceholderProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Abby&apos;s Attendance</p>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {signedInAs && <span className="hidden text-sm text-muted-foreground sm:inline">{signedInAs}</span>}
          <SignOutButton size="sm" />
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming in {phase}</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {planned.map(item => <li key={item}>{item}</li>)}
          </ul>
        </CardContent>
      </Card>
      {footer}
    </main>
  );
}
