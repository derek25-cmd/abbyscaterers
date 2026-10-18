"use client";

import React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductPickerProps extends Omit<React.ComponentPropsWithoutRef<typeof Button>, "value" | "onChange"> {
  products: Product[];
  value: string | null | undefined;
  onChange: (productId: string) => void;
  loading?: boolean;
  placeholder?: string;
  /** Show a "No product" entry that clears the selection (onChange("")). */
  allowClear?: boolean;
}

/**
 * Searchable product-catalog picker (name, SKU or id), showing the unit each
 * product is priced per. Used by the recipe form and the purchase form.
 * Extra props (id, aria-*) go to the trigger button, so it works inside
 * <FormControl>.
 */
export const ProductPicker = React.forwardRef<HTMLButtonElement, ProductPickerProps>(function ProductPicker(
  { products, value, onChange, loading, placeholder = "Select product", allowClear, disabled, className, ...buttonProps },
  ref
) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? products.find(p => p.id === value) : undefined;
  const label = loading
    ? "Loading..."
    : selected
      ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ""}`
      : value
        ? `${value} (not in catalog)`
        : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
          disabled={disabled || loading}
          {...buttonProps}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search product name or SKU..." />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem value="__none__ no product" onSelect={() => { onChange(""); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 text-muted-foreground">No product</span>
                </CommandItem>
              )}
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name ?? ""} ${p.sku ?? ""} ${p.id}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[p.sku, p.base_unit || p.unit].filter(Boolean).join(" · ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

/** The unit a product is priced per (base_unit, falling back to unit). */
export function productPriceUnit(product: Product | undefined | null): string | null {
  return product ? (product.base_unit || product.unit || null) : null;
}
