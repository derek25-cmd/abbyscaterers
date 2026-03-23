'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, Truck, Search, Box, Wrench, CheckCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { AddAssetDialog } from '@/components/hr/add-asset-dialog';
import { EditAssetDialog } from '@/components/hr/edit-asset-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViewAssetDialog } from '@/components/hr/view-asset-dialog';
import { getAssets, addAsset, updateAsset, transferAsset } from '@/services/assetService';
import { format, parseISO, isValid } from 'date-fns';
import { TransferAssetDialog } from '@/components/hr/transfer-asset-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddAssetDialogOpen, setIsAddAssetDialogOpen] = useState(false);
  const [isEditAssetDialogOpen, setIsEditAssetDialogOpen] = useState(false);
  const [isViewAssetDialogOpen, setIsViewAssetDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const fetchAssets = async () => {
    setLoading(true);
    const assetsData = await getAssets();
    setAssets(assetsData);
    setLoading(false);
  };
  
  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || asset.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || asset.type === typeFilter;
        const matchesBranch = branchFilter === 'all' || asset.branch === branchFilter;
        return matchesSearch && matchesType && matchesBranch;
    });
  }, [assets, searchQuery, typeFilter, branchFilter]);

  const stats = useMemo(() => {
    return {
        total: assets.length,
        available: assets.filter(a => a.status === 'Available').length,
        inUse: assets.filter(a => a.status === 'In Use').length,
        maintenance: assets.filter(a => a.status === 'Under Maintenance').length,
    }
  }, [assets]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Use':
        return <Badge className="bg-blue-500/20 text-blue-700 hover:bg-blue-500/30">In Use</Badge>;
      case 'Available':
        return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">Available</Badge>;
      case 'Under Maintenance':
        return <Badge className="bg-orange-500/20 text-orange-700 hover:bg-orange-500/30">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const handleAddAsset = async (newAsset: any) => {
    await addAsset(newAsset);
    await fetchAssets();
  };
  
  const handleEditAsset = async (updatedAsset: any) => {
    await updateAsset(updatedAsset.id, updatedAsset);
    await fetchAssets();
  };

  const handleTransferAsset = async (transferData: any) => {
    await transferAsset(transferData);
    await fetchAssets();
  }

  const openEditDialog = (asset: any) => {
    setSelectedAsset(asset);
    setIsEditAssetDialogOpen(true);
  };

  const openViewDialog = (asset: any) => {
    setSelectedAsset(asset);
    setIsViewAssetDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'N/A';
  }

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Asset Management</h1>
          <div className="ml-auto flex items-center gap-2">
             <Button size="sm" className="h-8 gap-1" variant="outline" onClick={() => setIsTransferDialogOpen(true)}>
              <Truck className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Transfer Assets
              </span>
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddAssetDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Asset
              </span>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                    <Box className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Available</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{stats.available}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">In Use</CardTitle>
                    <Truck className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-blue-600">{stats.inUse}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
                    <Wrench className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-orange-600">{stats.maintenance}</div></CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asset Register</CardTitle>
            <CardDescription>
              Track company equipment, utensils, and vehicles across branches.
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Vehicle">Vehicle</SelectItem>
                  <SelectItem value="Kitchen Equipment">Kitchen Equipment</SelectItem>
                  <SelectItem value="Service Utensil">Service Utensil</SelectItem>
                  <SelectItem value="Event Equipment">Event Equipment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                  <SelectItem value="Arusha">Arusha</SelectItem>
                  <SelectItem value="Dodoma">Dodoma</SelectItem>
                </SelectContent>
              </Select>
          </div>
          <CardContent>
             {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Maint.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs">{asset.id}</TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell><Badge variant="secondary">{asset.branch}</Badge></TableCell>
                    <TableCell className="text-xs">{asset.type}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(asset.unitPrice)}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-xs">{formatDate(asset.lastMaintenance)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(asset)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(asset)}>Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No matching assets found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      
      <AddAssetDialog 
        isOpen={isAddAssetDialogOpen}
        setIsOpen={setIsAddAssetDialogOpen}
        onAddAsset={handleAddAsset}
      />
      {selectedAsset && (
        <EditAssetDialog
            isOpen={isEditAssetDialogOpen}
            setIsOpen={setIsEditAssetDialogOpen}
            asset={selectedAsset}
            onEditAsset={handleEditAsset}
        />
      )}
      {selectedAsset && (
        <ViewAssetDialog
            isOpen={isViewAssetDialogOpen}
            setIsOpen={setIsViewAssetDialogOpen}
            asset={selectedAsset}
        />
      )}
       <TransferAssetDialog
        isOpen={isTransferDialogOpen}
        setIsOpen={setIsTransferDialogOpen}
        assets={assets}
        onTransferAsset={handleTransferAsset}
      />
    </main>
  );
}
