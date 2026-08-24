
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingPageProps {
    title?: string;
    message?: string;
}

export function LoadingPage({ title = "Loading...", message = "Please wait while we prepare the page for you." }: LoadingPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gradient-to-br from-background to-muted/30 animate-fade-in">
        <div className="w-full max-w-md p-8 text-center space-y-4">
            <div className="relative w-24 h-24 mx-auto">
                <Loader2 className="h-24 w-24 animate-spin text-primary opacity-30" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-primary-glow animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold text-foreground animate-fade-in [animation-delay:0.2s]">{title}</h1>
            <p className="text-muted-foreground text-lg animate-fade-in [animation-delay:0.4s]">{message}</p>
        </div>
    </div>
  );
}
