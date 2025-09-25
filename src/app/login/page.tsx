
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      // The onAuthStateChange listener in useAuth will handle the redirect
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Could not log in with Google. Please try again.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6 text-center">
           <div className="grid gap-2">
             <div className="flex items-center justify-center gap-2 mb-4">
                <Image src="/logo.png" alt="Abby's Catersmart Logo" width={200} height={50} style={{ mixBlendMode: 'darken' }}/>
             </div>
            <h1 className="text-3xl font-bold">Welcome Back</h1>
            <p className="text-balance text-muted-foreground">
              Sign in with your Google account to access your dashboard.
            </p>
          </div>
          <Button onClick={handleLogin} disabled={isLoading} className="w-full">
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 401.8 0 265.5S110.3 19 244 19c67.3 0 125.2 24.8 170.8 68.3l-64.3 62.5C314.5 118.5 282.8 100 244 100c-82.3 0-149.3 66.8-149.3 148.9s67 148.9 149.3 148.9c97.6 0 129.1-71.2 132.8-109.9H244V261.8h244z"></path></svg>
            )}
             {isLoading ? "Signing in..." : "Sign in with Google"}
          </Button>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/seed/catering/1200/1800"
          alt="A well-prepared catering dish"
          data-ai-hint="catering dish"
          width="1200"
          height="1800"
          className="h-full w-full object-cover dark:brightness-[0.3]"
        />
      </div>
    </div>
  );
}
