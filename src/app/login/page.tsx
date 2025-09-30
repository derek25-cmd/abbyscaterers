
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useSettingsStorage } from '@/hooks/use-settings-storage';

export default function LoginPage() {
  const { user, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettingsStorage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleAuthAction = async () => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        toast({
          title: "Account Created",
          description: "Please check your email to confirm your account.",
        });
        // Stay on the page to show the toast
      } else {
        await signInWithEmail(email, password);
        // The onAuthStateChange listener will handle redirect on successful login
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: isSignUp ? "Sign Up Failed" : "Login Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <Card className="mx-auto w-[380px]">
           <CardHeader className="text-center">
             <div className="flex items-center justify-center gap-2 mb-4">
                <Image src="/logo.png" alt="Abby's Catersmart Logo" width={200} height={50} style={{ mixBlendMode: 'darken' }}/>
             </div>
            <CardTitle className="text-2xl font-bold">{isSignUp ? 'Create an Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {isSignUp ? 'Enter your details to get started.' : 'Enter your credentials to access your dashboard.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleAuthAction} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="text-center text-sm">
             <p className="w-full">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <Button variant="link" onClick={() => setIsSignUp(!isSignUp)} className="font-semibold">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="hidden bg-muted lg:block">
        {settings.loginImageUrl && (
            <Image
            src={settings.loginImageUrl}
            alt="A well-prepared catering dish"
            data-ai-hint="catering dish"
            width="1200"
            height="1800"
            className="h-full w-full object-cover dark:brightness-[0.3]"
            priority
            />
        )}
      </div>
    </div>
  );
}
