// @ts-nocheck
'use client';

import { AppLayout } from "@/components/hr/AppLayout";
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


export default function IssuancePage() {
    const [log, setLog] = useState([]);
    const [assets, setAssets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isIssuanceDialogOpen, setIsIssuanceDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [logsData, assetsData, employeesData] = await Promise.all([
                getIssuances(),
                getAssets(),
                getEmployees()
            ]);
            setLog(logsData);
            setAssets(assetsData);
            setEmployees(employeesData);
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
          default:
            return <Badge variant="outline">{status}</Badge>;
        }
    };
    
    const handleNewIssuance = async (issuanceData: { assetId: string, employeeId: string }) => {
        const asset = assets.find(a => a.id === issuanceData.assetId);
        const employee = employees.find(e => e.id === issuanceData.employeeId);
        
        const employeeFullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');

        if (asset && employee) {
            if(asset.status !== 'Available') {
                alert('Asset is not available to be issued.');
                return;
            }

            const newLogEntry = {
                assetId: asset.id,
                name: asset.name,
                issuedTo: employeeFullName,
                type: asset.type,
                unit: asset.unit,
                unitPrice: asset.unitPrice,
                quantity: 1, // Assets are issued one by one
                date: new Date().toISOString().split('T')[0],
                status: 'Issued'
            };
            
            const newId = await addIssuance(newLogEntry);
            setLog(prevLog => [{ id: newId, ...newLogEntry }, ...prevLog]);

            const updatedAsset = { ...asset, status: 'In Use' };
            await updateAsset(asset.id, updatedAsset);
            setAssets(assets.map(a => a.id === asset.id ? updatedAsset : a));
        }
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
      setSelectedLog(logEntry);
      setIsViewDialogOpen(true);
    };

    const handleStatusChange = async (logId: string, newStatus: 'Returned') => {
        const logEntry = log.find(l => l.id === logId);
        if (!logEntry || logEntry.status === 'Returned') return;

        const updatedLogEntry = { ...logEntry, status: newStatus };
        await updateIssuance(logId, updatedLogEntry);
        setLog(log.map(l => l.id === logId ? updatedLogEntry : l));

        if (newStatus === 'Returned') {
            const asset = assets.find(a => a.id === logEntry.assetId);
            if (asset) {
                const updatedAsset = { ...asset, status: 'Available' };
                await updateAsset(asset.id, updatedAsset);
                setAssets(assets.map(a => a.id === asset.id ? updatedAsset : a));
            }
        }
    };

  return (
    <AppLayout>
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
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Issued To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
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
                    <TableCell>{logEntry.name}</TableCell>
                    <TableCell>{logEntry.issuedTo}</TableCell>
                    <TableCell>{logEntry.type}</TableCell>
                    <TableCell>{logEntry.date}</TableCell>
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
      </main>
      <NewIssuanceDialog
        isOpen={isIssuanceDialogOpen}
        setIsOpen={setIsIssuanceDialogOpen}
        assets={assets.filter(a => a.status === 'Available')}
        employees={employees.filter(e => e.status === 'Active')}
        onNewIssuance={handleNewIssuance}
      />
      {selectedLog && (
        <EditIssuanceDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            logEntry={selectedLog}
            employees={employees}
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
    </AppLayout>
  );
}
