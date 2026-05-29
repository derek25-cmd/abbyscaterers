"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banknote, ShoppingCart, BookUser, BookUp, DollarSign, Building, FileText, Landmark, TrendingUp } from "lucide-react";

const financeNavItems = [
    { href: "/finances", label: "Event P&L Explorer", icon: TrendingUp },
    { href: "/finances/purchases", label: "Purchases Ledger", icon: ShoppingCart },
    { href: "/finances/sales", label: "Sales Ledger", icon: Banknote },
    { href: "/finances/receivables", label: "Receivables", icon: BookUser },
    { href: "/finances/payables", label: "Payables", icon: BookUp },
    { href: "/finances/cash-book", label: "Cash Book", icon: Landmark },
    { href: "/finances/expenses", label: "Expenses Book", icon: DollarSign },
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
          Track and manage all your catering business transactions, tax logs, and event profitabilities.
        </p>
      </div>
      
      <div className="flex items-center space-x-2 border-b pb-2 overflow-x-auto">
         {financeNavItems.map(item => {
             const isActive = item.href === "/finances" 
                 ? pathname === "/finances" 
                 : pathname.startsWith(item.href);
             
             return (
                 <Button 
                     key={item.href} 
                     variant={isActive ? "secondary" : "ghost"} 
                     asChild 
                     className="shrink-0 font-semibold"
                 >
                     <Link href={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4"/>
                        {item.label}
                     </Link>
                 </Button>
             );
         })}
      </div>

      <div className="p-4 bg-card rounded-lg shadow-sm border">
        {children}
      </div>
    </div>
  );
}
