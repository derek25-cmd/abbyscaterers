
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banknote, ShoppingCart, BookUser, BookUp, DollarSign, Building, FileText, Landmark } from "lucide-react";

const financeNavItems = [
    { href: "/finances/purchases", label: "Purchases", icon: ShoppingCart },
    { href: "/finances/sales", label: "Sales", icon: Banknote },
    { href: "/finances/receivables", label: "Receivables", icon: BookUser },
    { href: "/finances/payables", label: "Payables", icon: BookUp },
    { href: "/finances/cash-book", label: "Cash Book", icon: Landmark },
    { href: "/finances/expenses", label: "Expenses", icon: DollarSign },
    { href: "/finances/assets", label: "Fixed Assets", icon: Building },
    { href: "/finances/tax", label: "Tax Book", icon: FileText },
];

export default function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Financial Management
        </h1>
        <p className="text-muted-foreground">
          Track and manage all your company's financial records and statements.
        </p>
      </div>
      
      <div className="flex items-center space-x-2 border-b pb-2 overflow-x-auto">
         {financeNavItems.map(item => (
             <Button key={item.href} variant={pathname.startsWith(item.href) ? "secondary" : "ghost"} asChild className="shrink-0">
                 <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4"/>
                    {item.label}
                 </Link>
             </Button>
         ))}
      </div>

      <div className="p-4 bg-card rounded-lg shadow-sm">
        {children}
      </div>
    </div>
  );
}
