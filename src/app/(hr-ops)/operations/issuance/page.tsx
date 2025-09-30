
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, CalendarIcon, ListFilter, Search, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { NewIssuanceDialog } from "@/components/hr/new-issuance-dialog";
import { EditIssuanceDialog } from "@/components/hr/edit-issuance-dialog";
import { ViewIssuanceDialog } from "@/components/hr/view-issuance-dialog";
import { ReturnIssuanceDialog } from "@/components/hr/return-issuance-dialog";
import { getIssuances, addIssuance, updateIssuance } from "@/services/issuanceService";
import { getAssets, updateAsset } from "@/services/assetService";
import { getEmployees } from "@/services/employeeService";
import { getOrders } from "@/services/orderService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";


export default function IssuancePage() {
    const [log, setLog] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isIssuanceDialogOpen, setIsIssuanceDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("assetName");

    useEffect(() => {
        setSelectedDate(new Date());
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

    const filteredLog = useMemo(() => {
        let filteredData = log;
    
        if (selectedDate) {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            filteredData = filteredData.filter(entry => entry.date === dateStr);
        }

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            filteredData = filteredData.filter(entry => {
                switch (filterType) {
                    case 'id':
                        return entry.id.toLowerCase().includes(lowercasedQuery);
                    case 'orderId':
                        const orderName = orders.find(o => o.id === entry.orderId)?.name || '';
                        return orderName.toLowerCase().includes(lowercasedQuery) || (entry.orderId && entry.orderId.toLowerCase().includes(lowercasedQuery));
                    case 'issuedTo':
                        return entry.issuedTo.toLowerCase().includes(lowercasedQuery);
                    case 'assetName':
                    default:
                        return entry.items.some((item: any) => item.name.toLowerCase().includes(lowercasedQuery));
                }
            });
        }
        
        return filteredData;
    }, [log, selectedDate, searchQuery, filterType, orders]);

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
    
    const handleNewIssuance = async (issuanceData: any) => {
        // Create a shallow copy and remove the 'order' property before sending to Supabase
        const { order, ...payload } = issuanceData;
        await addIssuance(payload);

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


    const handleEditIssuance = async (updatedLog: any) => {
        await updateIssuance(updatedLog.id, updatedLog);
        setLog(prevLog => 
            prevLog.map(l => l.id === updatedLog.id ? updatedLog : l)
        );
    };

    const handleReturnIssuance = async (logId: string, returnedItems: any) => {
        const logEntry = log.find(l => l.id === logId);
        if (!logEntry) return;

        let allReturned = true;
        const updatedItems = logEntry.items.map((item: any) => {
            const returnedQty = returnedItems[item.assetId] || 0;
            const newReturnedQty = (item.quantityReturned || 0) + returnedQty;
            
            if (newReturnedQty < item.quantityIssued) {
                allReturned = false;
            }

            // Return stock
            const asset = assets.find(a => a.id === item.assetId);
            if (asset && returnedQty > 0) {
                const updatedAsset = { 
                    ...asset, 
                    quantity: asset.quantity + returnedQty,
                    status: asset.status === 'In Use' ? 'Available' : asset.status,
                };
                updateAsset(asset.id, updatedAsset);
            }
            
            return {
                ...item,
                quantityReturned: newReturnedQty,
            };
        });

        const newStatus = allReturned ? 'Returned' : 'Partially Returned';
        const updatedLogEntry = { ...logEntry, items: updatedItems, status: newStatus };
        
        await updateIssuance(logId, updatedLogEntry);

        // Refresh data
        const [logsData, assetsData] = await Promise.all([getIssuances(), getAssets()]);
        setLog(logsData);
        setAssets(assetsData);
    };


    const openEditDialog = (logEntry: any) => {
      setSelectedLog(logEntry);
      setIsEditDialogOpen(true);
    };

    const openViewDialog = (logEntry: any) => {
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
    
    const openReturnDialog = (logEntry: any) => {
        setSelectedLog(logEntry);
        setIsReturnDialogOpen(true);
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
              {selectedDate ? `Showing records for ${format(selectedDate, "MMMM dd, yyyy")}`: "Showing all records"}.
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0 flex items-center gap-2">
              <div className="relative flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search by ${filterType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Filter
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'assetName'} onCheckedChange={() => setFilterType('assetName')}>Asset Name</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Issue ID</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'orderId'} onCheckedChange={() => setFilterType('orderId')}>Order</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'issuedTo'} onCheckedChange={() => setFilterType('issuedTo')}>Issued To</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal h-9",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
               {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                  <X className="h-4 w-4 mr-1" />
                  Show All
                </Button>
              )}
          </div>
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
                {filteredLog.map((logEntry) => (
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
                             {logEntry.status !== 'Returned' && (
                                <DropdownMenuSeparator />
                             )}
                            {logEntry.status !== 'Returned' && (
                                <DropdownMenuItem onClick={() => openReturnDialog(logEntry)}>
                                    Return Items
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
        assets={assets.filter(a => a.quantity > 0)}
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
      {selectedLog && (
        <ReturnIssuanceDialog
            isOpen={isReturnDialogOpen}
            setIsOpen={setIsReturnDialogOpen}
            logEntry={selectedLog}
            onReturnIssuance={handleReturnIssuance}
        />
      )}
    </main>
  );
}
