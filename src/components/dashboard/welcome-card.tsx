
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { PlusCircle, BarChart3, Users } from "lucide-react";

export function WelcomeCard() {
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10 shadow-card">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Image src="/logo.png" alt="Abby's Catersmart Logo" width={80} height={80} style={{ mixBlendMode: 'darken' }} className="rounded-lg"/>
                    <div>
                        <CardTitle className="text-2xl font-bold text-primary">Welcome Back to Abby&apos;s Catersmart!</CardTitle>
                        <CardDescription className="text-muted-foreground">Here&apos;s what&apos;s happening with your business today.</CardDescription>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link href="/clients/new">
                            <Users className="mr-2 h-4 w-4" />
                            New Client
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/orders/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            New Order
                        </Link>
                    </Button>
                    <Button asChild variant="secondary">
                        <Link href="/reports">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            View Reports
                        </Link>
                    </Button>
                </div>
            </CardHeader>
        </Card>
    )
}
