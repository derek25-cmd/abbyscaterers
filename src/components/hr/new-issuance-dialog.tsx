
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useClientStorage } from "@/hooks/use-client-storage";
import { format } from "date-fns";


export function NewIssuanceDialog({ isOpen, setIsOpen, assets, employees, orders, onNewIssuance }) {
    const [orderId, setOrderId] = useState('');
    const [issuedTo, setIssuedTo] = useState('');
    const [items, setItems] = useState([{ assetId: '', quantityIssued: 1 }]);
    const [notes, setNotes] = useState('');
    const [totalValue, setTotalValue] = useState(0);
    const { getClientById } = useClientStorage();

    const getFullName = (employee) => {
        if (!employee) return '';
        return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
    }

    const resetForm = () => {
        setOrderId('');
        setIssuedTo('');
        setItems([{ assetId: '', quantityIssued: 1 }]);
        setNotes('');
        setTotalValue(0);
    }
    
    useEffect(() => {
        const value = items.reduce((acc, item) => {
            const asset = assets.find(a => a.id === item.assetId);
            return acc + (asset ? asset.unitPrice * item.quantityIssued : 0);
        }, 0);
        setTotalValue(value);
    }, [items, assets]);
    
    const todaysOrders = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return orders.filter(order => 
            order.clientEvents.some(event => event.date.startsWith(todayStr))
        );
    }, [orders]);


    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const numericValue = parseInt(value, 10);

        if (field === 'quantityIssued' && isNaN(numericValue)) {
            newItems[index][field] = 0;
        } else {
            newItems[index][field] = field === 'quantityIssued' ? numericValue : value;
        }
        
        const asset = assets.find(a => a.id === newItems[index].assetId);
        if (asset && newItems[index].quantityIssued > asset.quantity) {
            newItems[index].quantityIssued = asset.quantity;
        }
        
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { assetId: '', quantityIssued: 1 }]);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!orderId || !issuedTo || items.some(item => !item.assetId || item.quantityIssued <= 0)) {
            alert("Please fill all required fields, including at least one valid item.");
            return;
        }
        
        const employee = employees.find(e => e.id === issuedTo);
        const order = orders.find(o => o.id === orderId);

        const issuanceDetails = {
            orderId,
            order: order,
            issuedTo: getFullName(employee),
            items: items.map(item => {
                const asset = assets.find(a => a.id === item.assetId);
                return {
                    assetId: item.assetId,
                    name: asset.name,
                    type: asset.type,
                    unitPrice: asset.unitPrice,
                    quantityIssued: Number(item.quantityIssued),
                };
            }),
            totalValue,
            notes,
            status: 'Issued',
            date: new Date().toISOString().split('T')[0],
        };

        onNewIssuance(issuanceDetails);
        resetForm();
        setIsOpen(false);
    };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Asset Issuance</DialogTitle>
            <DialogDescription>
              Select an order, employee, and the assets to be issued for today&apos;s events.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="order">Client Order</Label>
                <Select onValueChange={setOrderId} value={orderId}>
                  <SelectTrigger><SelectValue placeholder="Select an order for today" /></SelectTrigger>
                  <SelectContent>
                    {todaysOrders.map(order => {
                      const client = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
                      return (
                        <SelectItem key={order.id} value={order.id}>
                            {client ? `${client.companyName} (${order.id})` : order.name}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="employee">Issued To</Label>
                 <Select onValueChange={setIssuedTo} value={issuedTo}>
                    <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>{getFullName(employee)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <Label className="text-lg font-semibold">Issued Items</Label>
              {items.map((item, index) => (
                <div key={index} className="flex items-end gap-2 p-2 border rounded-md">
                    <div className="flex-1">
                        <Label>Asset</Label>
                        <Select value={item.assetId} onValueChange={(value) => handleItemChange(index, 'assetId', value)}>
                            <SelectTrigger><SelectValue placeholder="Select an asset" /></SelectTrigger>
                            <SelectContent>
                                {assets.map(asset => (
                                    <SelectItem key={asset.id} value={asset.id}>{asset.name} (Qty: {asset.quantity})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-24">
                        <Label>Quantity</Label>
                        <Input
                            type="number"
                            value={item.quantityIssued}
                            onChange={(e) => handleItemChange(index, 'quantityIssued', e.target.value)}
                            min="1"
                            max={assets.find(a => a.id === item.assetId)?.quantity || 1}
                        />
                    </div>
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
             <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="text-right font-bold text-lg">
                Total Value: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(totalValue).replace('TZS', 'TZS ')}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </DialogClose>
            <Button type="submit">Issue Assets</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
