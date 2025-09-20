// @ts-nocheck
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MinusCircle, MoreHorizontal, CalendarIcon, Search, ListFilter, ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { LogStockMovementDialog } from "@/components/operations/log-stock-movement-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { EditStockLogDialog } from "@/components/operations/edit-stock-log-dialog";
import { ViewStockLogDialog } from "@/components/operations/view-stock-log-dialog";
import { getStockLogs, addStockLog, updateStockLog } from "@/services/stockLogService";
import { getProducts, updateProduct } from "@/services/productService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";

export default function StockLogsPage() {
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logType, setLogType] = useState<'Stock In' | 'Stock Out'>('Stock In');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("productName");

  useEffect(() => {
    setSelectedDate(new Date());
    const fetchData = async () => {
        setLoading(true);
        const [logsData, productsData] = await Promise.all([
            getStockLogs(),
            getProducts()
        ]);
        setLogs(logsData.sort((a,b) => new Date(b.date) - new Date(a.date)));
        setProducts(productsData);
        setLoading(false);
    }
    fetchData();
  }, []);

  const handleOpenLogDialog = (type: 'Stock In' | 'Stock Out') => {
    setLogType(type);
    setIsLogDialogOpen(true);
  };
  
  const handleLogMovement = async (movement) => {
    const product = products.find(p => p.id === movement.productId);
    
    if(!product) {
        alert("Product not found");
        return;
    }

    const newLog = {
        ...movement,
        productName: product.name,
        price: product.unitPrice * movement.quantity,
        date: format(new Date(), 'yyyy-MM-dd'),
        status: movement.type,
    };
    
    const newId = await addStockLog(newLog);
    
    // Optimistic UI update for logs
    const tempNewLog = { id: newId, ...newLog };
    setLogs(prevLogs => [tempNewLog, ...prevLogs].sort((a,b) => new Date(b.date) - new Date(a.date)));

    const updatedProduct = { ...product };
    if(movement.type === 'Stock In') {
        updatedProduct.quantity += movement.quantity;
    } else {
        if(product.quantity < movement.quantity) {
            alert('Not enough stock to log out');
            // Revert optimistic UI update if needed
            setLogs(prevLogs => prevLogs.filter(l => l.id !== newId));
            return;
        }
        updatedProduct.quantity -= movement.quantity;
    }
    
    await updateProduct(product.id, updatedProduct);
    // Optimistic UI update for products
    setProducts(products.map(p => p.id === product.id ? updatedProduct : p));
  };

  const handleEditLog = async (updatedLog) => {
    await updateStockLog(updatedLog.id, updatedLog);
    setLogs(prevLogs => 
        prevLogs.map(log => 
            log.id === updatedLog.id ? updatedLog : log
        ).sort((a,b) => new Date(b.date) - new Date(a.date))
    );
  };

  const openEditDialog = (log) => {
    setSelectedLog(log);
    setIsEditDialogOpen(true);
  };
  
  const openViewDialog = (log) => {
    setSelectedLog(log);
    setIsViewDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const dailySummary = useMemo(() => {
    if (!selectedDate) return { stockedIn: { items: 0, value: 0 }, stockedOut: { items: 0, value: 0 }, closingValue: 0 };

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dailyLogs = logs.filter(log => log.date === dateStr);
    
    const summary = dailyLogs.reduce((acc, log) => {
      const price = Number(log.price) || 0;
      const quantity = Number(log.quantity) || 0;
      if (log.type === 'Stock In') {
        acc.stockedIn.items += quantity;
        acc.stockedIn.value += price;
      } else {
        acc.stockedOut.items += quantity;
        acc.stockedOut.value += price;
      }
      return acc;
    }, { stockedIn: { items: 0, value: 0 }, stockedOut: { items: 0, value: 0 } });
    
    const currentTotalValue = products.reduce((total, p) => total + (p.quantity * p.unitPrice), 0);
    
    const logsAfterDate = logs.filter(log => {
      const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
      return logDate > selectedDate;
    });
    
    const valueOfFutureLogs = logsAfterDate.reduce((total, log) => {
        if (log.type === 'Stock In') {
            return total - log.price; 
        } else {
            return total + log.price;
        }
    }, 0);

    summary.closingValue = currentTotalValue + valueOfFutureLogs;
    
    return summary;
  }, [selectedDate, logs, products]);


  const filteredLogs = useMemo(() => {
     const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
     return logs.filter((log) => {
        const matchesDate = dateStr ? log.date === dateStr : true;
        if (!matchesDate) return false;

        if (!searchQuery) return true;
        const lowercasedQuery = searchQuery.toLowerCase();
        
        const valueToFilter = log[filterType] || '';
        return valueToFilter.toString().toLowerCase().includes(lowercasedQuery);
    });
  }, [logs, selectedDate, searchQuery, filterType]);

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Stock Movement Logs</h1>
          <div className="ml-auto flex items-center gap-2">
             <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => handleOpenLogDialog('Stock Out')}>
                <MinusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Log Stock Out
                </span>
            </Button>
            <Button size="sm" className="h-9 gap-1" onClick={() => handleOpenLogDialog('Stock In')}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Log Stock In
              </span>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stocked In</CardTitle>
                    <ArrowDown className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailySummary.stockedIn.value)}</div>
                    <p className="text-xs text-muted-foreground">
                        {dailySummary.stockedIn.items} items received
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stocked Out</CardTitle>
                    <ArrowUp className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailySummary.stockedOut.value)}</div>
                    <p className="text-xs text-muted-foreground">
                        {dailySummary.stockedOut.items} items issued
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Closing Stock Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailySummary.closingValue)}</div>
                    <p className="text-xs text-muted-foreground">
                        Total value at end of day
                    </p>
                </CardContent>
            </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Movement History</CardTitle>
            <CardDescription>
              {selectedDate ? `Showing stock movements for ${format(selectedDate, "MMMM dd, yyyy")}` : 'Track all inventory coming in and going out.'}
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0 flex items-center gap-2">
              <div className="relative flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
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
                      Filter by {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>ID</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'productName'} onCheckedChange={() => setFilterType('productName')}>Product</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'reason'} onCheckedChange={() => setFilterType('reason')}>Reason</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'status'} onCheckedChange={() => setFilterType('status')}>Status</DropdownMenuCheckboxItem>
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
          </div>
          <CardContent>
            {loading ? (
                <p>Loading stock logs...</p>
            ) : (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock Issue ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price (TZS)</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{log.productName}</div>
                        <div className="text-sm text-muted-foreground">{log.productId}</div>
                      </TableCell>
                      <TableCell>{log.type}</TableCell>
                      <TableCell className="text-right">{log.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(log.price)}</TableCell>
                      <TableCell>{log.reason}</TableCell>
                      <TableCell>{log.date}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'Stock In' ? 'default' : 'secondary'} className={log.status === 'Stock In' ? 'bg-green-500/80' : 'bg-red-500/80'}>
                            {log.status}
                        </Badge>
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => openViewDialog(log)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(log)}>Edit</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      
      <LogStockMovementDialog
        isOpen={isLogDialogOpen}
        setIsOpen={setIsLogDialogOpen}
        logType={logType}
        onLogMovement={handleLogMovement}
        products={products}
      />
      {selectedLog && (
        <EditStockLogDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            log={selectedLog}
            onEditLog={handleEditLog}
            products={products}
        />
      )}
      {selectedLog && (
        <ViewStockLogDialog
            isOpen={isViewDialogOpen}
            setIsOpen={setIsViewDialogOpen}
            log={selectedLog}
        />
      )}
    </main>
  );
}
