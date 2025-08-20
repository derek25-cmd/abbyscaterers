
// @ts-nocheck
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import { NewIssuanceDialog } from "@/components/hr/new-issuance-dialog";
import { EditIssuanceDialog } from "@/components/hr/edit-issuance-dialog";
import { ViewIssuanceDialog } from "@/components/hr/view-issuance-dialog";
import { getIssuances, addIssuance, updateIssuance } from "@/services/issuanceService";
import { getAssets, updateAsset } from "@/services/assetService";
import { getEmployees } from "@/services/employeeService";
import { getOrders } from "@/services/orderService";


export default function IssuancePage() {
    const [log, setLog] = useState([]);
    const [assets, setAssets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isIssuanceDialogOpen, setIsIssuanceDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [logsData, assetsData, employeesData, ordersData] = await Promise.all([
                getIssuances(),
                getAssets(),
                getEmployees(),
                getOrders()
            ]);
            setLog(logsData);
            setAssets(assetsData);
            setEmployees(employeesData);
            setOrders(ordersData);
            setLoading(false);
        }
        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
          case 'Issued':
            return <Badge className="bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">Issued</Badge>;
          case 'Returned':
            return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:bg-green-500/10 dark:text-green-400">Returned</Badge>;
          case 'Partially Returned':
            return <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700">{status}</Badge>;
        case 'Incomplete':
            return <Badge variant="destructive">{status}</Badge>;
          default:
            return <Badge variant="outline">{status}</Badge>;
        }
    };
    
    const handleNewIssuance = async (issuanceData) => {
        const newId = await addIssuance(issuanceData);

        // Update asset quantities
        for (const item of issuanceData.items) {
            const asset = assets.find(a => a.id === item.assetId);
            if (asset) {
                const updatedAsset = { ...asset, quantity: asset.quantity - item.quantityIssued };
                 // Change status if quantity is 0 or it's not In Use already
                if (updatedAsset.quantity === 0) {
                    updatedAsset.status = 'In Use'; 
                }
                await updateAsset(asset.id, updatedAsset);
            }
        }
        
        // Refresh local data
        const [logsData, assetsData] = await Promise.all([getIssuances(), getAssets()]);
        setLog(logsData);
        setAssets(assetsData);
    };


    const handleEditIssuance = async (updatedLog) => {
        await updateIssuance(updatedLog.id, updatedLog);
        setLog(prevLog => 
            prevLog.map(l => l.id === updatedLog.id ? updatedLog : l)
        );
    };

    const openEditDialog = (logEntry) => {
      setSelectedLog(logEntry);
      setIsEditDialogOpen(true);
    };

    const openViewDialog = (logEntry) => {
      const employee = employees.find(e => {
        const fullName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
        return fullName === logEntry.issuedTo;
      });
      const order = orders.find(o => o.id === logEntry.orderId);
      
      setSelectedLog({
        ...logEntry,
        employee,
        order
      });
      setIsViewDialogOpen(true);
    };

    const handleStatusChange = async (logId: string, newStatus: 'Returned') => {
        const logEntry = log.find(l => l.id === logId);
        if (!logEntry || logEntry.status === 'Returned') return;

        const updatedLogEntry = { ...logEntry, status: newStatus };
        await updateIssuance(logId, updatedLogEntry);
        setLog(log.map(l => l.id === logId ? updatedLogEntry : l));

        if (newStatus === 'Returned') {
            for (const item of logEntry.items) {
                 const asset = assets.find(a => a.id === item.assetId);
                 if (asset) {
                    const updatedAsset = { ...asset, quantity: asset.quantity + item.quantityIssued };
                    // If all items are back, set to available
                    if (updatedAsset.quantity > 0) {
                        updatedAsset.status = 'Available';
                    }
                    await updateAsset(asset.id, updatedAsset);
                 }
            }
            const assetsData = await getAssets();
            setAssets(assetsData);
        }
    };

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Daily Issuance Log</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsIssuanceDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                New Issuance
              </span>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Issuance History</CardTitle>
            <CardDescription>
              Record and manage daily issuance of stock and equipment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p>Loading issuance log...</p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue ID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((logEntry) => (
                  <TableRow key={logEntry.id}>
                    <TableCell className="font-medium">{logEntry.id}</TableCell>
                    <TableCell>{orders.find(o => o.id === logEntry.orderId)?.name || 'N/A'}</TableCell>
                    <TableCell>{logEntry.issuedTo}</TableCell>
                    <TableCell>{logEntry.date}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(logEntry.totalValue).replace('TZS', 'TZS ')}</TableCell>
                    <TableCell>{getStatusBadge(logEntry.status)}</TableCell>
                    <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openViewDialog(logEntry)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(logEntry)}>Edit</DropdownMenuItem>
                            {logEntry.status === 'Issued' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(logEntry.id, 'Returned')}>
                                    Mark as Returned
                                </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      
      <NewIssuanceDialog
        isOpen={isIssuanceDialogOpen}
        setIsOpen={setIsIssuanceDialogOpen}
        assets={assets.filter(a => a.status === 'Available')}
        employees={employees.filter(e => e.status === 'Active')}
        orders={orders}
        onNewIssuance={handleNewIssuance}
      />
      {selectedLog && (
        <EditIssuanceDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            logEntry={selectedLog}
            employees={employees}
            orders={orders}
            onEditIssuance={handleEditIssuance}
        />
      )}
       {selectedLog && (
        <ViewIssuanceDialog
            isOpen={isViewDialogOpen}
            setIsOpen={setIsViewDialogOpen}
            logEntry={selectedLog}
        />
      )}
    </main>
  );
}
