'use client';

import { useState, useMemo } from "react";
import { Building, Search, Hammer, ShieldAlert, BadgeInfo, Landmark, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getAssets } from "@/services/assetService";
import { Asset } from "@/types";

export default function FixedAssetsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: getAssets,
  });

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBranch = branchFilter === "ALL" || a.branch === branchFilter;

      return matchesSearch && matchesBranch;
    });
  }, [assets, searchQuery, branchFilter]);

  const totalCapitalValuation = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + (a.unitPrice * a.quantity), 0);
  }, [filteredAssets]);

  const totalAssetsCount = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + a.quantity, 0);
  }, [filteredAssets]);

  const maintenanceNeededCount = useMemo(() => {
    return filteredAssets.filter(a => a.status === "Under Maintenance").length;
  }, [filteredAssets]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  };

  return (
    <div className="space-y-6">
      {/* Assets Register Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capital Valuation</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCapitalValuation)}</div>
            <p className="text-xs text-muted-foreground">Original acquisition cost sum</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Asset Count</CardTitle>
            <Building className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalAssetsCount} pcs</div>
            <p className="text-xs text-muted-foreground">Total quantity of operational items</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
            <Hammer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{maintenanceNeededCount} assets</div>
            <p className="text-xs text-muted-foreground">Items currently offline for servicing</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Branches Registered</CardTitle>
            <Landmark className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">3 Cities</div>
            <p className="text-xs text-muted-foreground">Dar es Salaam, Arusha, Dodoma</p>
          </CardContent>
        </Card>
      </div>

      {/* Assets Register Grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building />
                Fixed Assets Capital Register
              </CardTitle>
              <CardDescription>
                Corporate register of long-term investments, catering equipment, refrigeration units, and delivery vehicles.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches</SelectItem>
                  <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                  <SelectItem value="Arusha">Arusha</SelectItem>
                  <SelectItem value="Dodoma">Dodoma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="pt-2">
            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset ID</TableHead>
                <TableHead>Asset Name</TableHead>
                <TableHead>Category Type</TableHead>
                <TableHead>Operating Branch</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Capital Valuation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Serviced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center">Loading assets register...</TableCell></TableRow>
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs font-semibold">{asset.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium text-foreground">{asset.name}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-purple-500/30 text-purple-700 bg-purple-500/5">
                        {asset.branch}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{asset.quantity} {asset.unit}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(asset.unitPrice)}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(asset.unitPrice * asset.quantity)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={asset.status === 'Available' ? 'default' : 'destructive'}
                        className={asset.status === 'Available' ? 'bg-emerald-600' : 'bg-red-500'}
                      >
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{asset.lastMaintenance || "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No fixed assets found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-bold text-base">Total Capital Valuation</TableCell>
                <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(totalCapitalValuation)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
