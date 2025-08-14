// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function NewIssuanceDialog({ isOpen, setIsOpen, assets, employees, onNewIssuance }) {
  const [assetId, setAssetId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const getFullName = (employee) => {
    return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!assetId || !employeeId) {
      alert("Please select an asset and an employee.");
      return;
    }

    onNewIssuance({
      assetId,
      employeeId,
    });

    // Reset form and close dialog
    setAssetId('');
    setEmployeeId('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Asset Issuance</DialogTitle>
            <DialogDescription>
              Select an asset to issue and the employee receiving it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="asset" className="text-right">
                Asset
              </Label>
              <Select onValueChange={setAssetId} value={assetId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">
                Employee
              </Label>
              <Select onValueChange={setEmployeeId} value={employeeId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {getFullName(employee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Issue Asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
