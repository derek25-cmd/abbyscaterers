
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const invoicingNavItems = [
    { href: "/invoicing/proforma-invoices", label: "Proforma Invoices" },
    { href: "/invoicing/invoices", label: "Final Invoices" }
];

export default function InvoicingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Invoicing
        </h1>
        <p className="text-muted-foreground">
          Create, view, and manage all your proforma and final invoices here.
        </p>
      </div>
      
      <div className="flex items-center space-x-2 border-b pb-2">
         {invoicingNavItems.map(item => (
             <Button key={item.href} variant={pathname.startsWith(item.href) ? "secondary" : "ghost"} asChild>
                 <Link href={item.href}>{item.label}</Link>
             </Button>
         ))}
      </div>

      <div>{children}</div>
    </div>
  );
}
