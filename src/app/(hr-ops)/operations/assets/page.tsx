'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AddAssetDialog } from '@/components/hr/add-asset-dialog';
import { EditAssetDialog } from '@/components/hr/edit-asset-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViewAssetDialog } from '@/components/hr/view-asset-dialog';
import { getAssets, addAsset, updateAsset } from '@/services/assetService';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddAssetDialogOpen, setIsAddAssetDialogOpen] = useState(false);
  const [isEditAssetDialogOpen, setIsEditAssetDialogOpen] = useState(false);
  const [isViewAssetDialogOpen, setIsViewAssetDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  useEffect(() => {
    const fetchAssets = async () => {
      const assetsData = await getAssets();
      setAssets(assetsData);
      setLoading(false);
    };
    fetchAssets();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Use':
        return <Badge className="bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">In Use</Badge>;
      case 'Available':
        return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:bg-green-500/10 dark:text-green-400">Available</Badge>;
      case 'Under Maintenance':
        return <Badge className="bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">Under Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const handleAddAsset = async (newAsset: any) => {
    const assetToAdd = { ...newAsset };
    const newId = await addAsset(assetToAdd);
    setAssets(prevAssets => [{ id: newId, ...assetToAdd }, ...prevAssets]);
  };
  
  const handleEditAsset = async (updatedAsset: any) => {
    await updateAsset(updatedAsset.id, updatedAsset);
    setAssets(prevAssets => 
        prevAssets.map(asset => 
            asset.id === updatedAsset.id ? updatedAsset : asset
        )
    );
  };

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

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Asset Management</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddAssetDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Asset
              </span>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All Company Assets</CardTitle>
            <CardDescription>
              Track and manage your company assets, including equipment, utensils, and vehicles.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? (
                <p>Loading assets...</p>
              ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Maintenance</TableHead>
                  <TableHead>Next Maintenance</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.id}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.type}</TableCell>
                    <TableCell>{asset.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(asset.unitPrice)}</TableCell>
                    <TableCell className="text-right">{asset.quantity}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell>{asset.lastMaintenance}</TableCell>
                    <TableCell>{asset.nextMaintenance}</TableCell>
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
                          <DropdownMenuItem onClick={() => openViewDialog(asset)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(asset)}>Edit</DropdownMenuItem>
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
    </main>
  );
}
