'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, Search, Package, ListFilter, TrendingDown, PackageX, CreditCard, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { AddProductDialog } from "@/components/hr/add-product-dialog";
import { EditProductDialog } from "@/components/hr/edit-product-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ViewProductDialog } from "@/components/hr/view-product-dialog";
import { Input } from "@/components/ui/input";
import { getProducts, addProduct, updateProduct } from "@/services/productService";
import type { Product } from "@/types";

export default function InventoryPage() {
  const [stock, setStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [isViewProductDialogOpen, setIsViewProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("name");

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const products = await getProducts();
      setStock(products);
      setLoading(false);
    };
    fetchProducts();
  }, []);
  
  const handleAddProduct = async (newProduct: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'>) => {
    const addedProduct = await addProduct(newProduct);
    if(addedProduct){
        setStock(prevStock => [addedProduct, ...prevStock]);
    }
  };

  const handleEditProduct = async (updatedProduct: Product) => {
    await updateProduct(updatedProduct.id, updatedProduct);
    setStock(prevStock => 
        prevStock.map(product => 
            product.id === updatedProduct.id ? updatedProduct : product
        )
    );
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsEditProductDialogOpen(true);
  };
  
  const openViewDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsViewProductDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getStatusText = (item: Product) => {
    if (item.quantity === 0) return 'out of stock';
    if (item.quantity < item.minStock) return 'low stock';
    return 'in stock';
  };

  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
        if (!searchQuery) return true;
        const lowercasedQuery = searchQuery.toLowerCase();
        
        switch (filterType) {
            case 'id':
                return item.id.toLowerCase().includes(lowercasedQuery);
            case 'name':
                return item.name.toLowerCase().includes(lowercasedQuery);
            case 'type':
                return item.category.toLowerCase().includes(lowercasedQuery);
            case 'status':
                return getStatusText(item).includes(lowercasedQuery);
            default:
                return item.name.toLowerCase().includes(lowercasedQuery);
        }
    });
  }, [stock, searchQuery, filterType]);

  const totalInventoryValue = useMemo(() => stock.reduce((total, item) => total + (item.unitPrice * item.quantity), 0), [stock]);
  const lowStockItems = useMemo(() => stock.filter(item => item.quantity > 0 && item.quantity < item.minStock).length, [stock]);
  const outOfStockItems = useMemo(() => stock.filter(item => item.quantity === 0).length, [stock]);

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
            <h1 className="font-headline text-2xl font-bold">Product Catalog</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stock.length}</div>
                    <p className="text-xs text-muted-foreground">
                        Total unique products
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</div>
                    <p className="text-xs text-muted-foreground">
                        Sum of all products in stock
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
                    <p className="text-xs text-muted-foreground">
                        Items below minimum stock level
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Out of Stock Items</CardTitle>
                    <PackageX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
                    <p className="text-xs text-muted-foreground">
                        Items with zero quantity
                    </p>
                </CardContent>
            </Card>
        </div>
        <Card>
          <CardHeader>
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Inventory List</CardTitle>
                    <CardDescription>
                        Manage your inventory items and their details.
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                            <DropdownMenuCheckboxItem checked={filterType === 'name'} onCheckedChange={() => setFilterType('name')}>Name</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterType === 'type'} onCheckedChange={() => setFilterType('type')}>Type</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterType === 'status'} onCheckedChange={() => setFilterType('status')}>Status</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" className="h-9 gap-1" onClick={() => setIsAddProductDialogOpen(true)}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Product
                        </span>
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : (
                <div className="relative w-full overflow-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                            <span className="sr-only">Actions</span>
                        </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStock.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium font-mono text-xs">{item.id}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                            <TableCell>
                            {item.quantity === 0 ? (
                                <Badge variant="destructive">Out of Stock</Badge>
                            ) : item.quantity < item.minStock ? (
                                <Badge className="bg-orange-500 hover:bg-orange-600">Low Stock</Badge>
                            ) : (
                                <Badge className="bg-green-600 hover:bg-green-700">In Stock</Badge>
                            )}
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
                                <DropdownMenuItem onClick={() => openViewDialog(item)}>View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(item)}>Edit</DropdownMenuItem>
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
      
      <AddProductDialog
        isOpen={isAddProductDialogOpen}
        setIsOpen={setIsAddProductDialogOpen}
        onAddProduct={handleAddProduct}
      />
      {selectedProduct && (
        <EditProductDialog
            isOpen={isEditProductDialogOpen}
            setIsOpen={setIsEditProductDialogOpen}
            product={selectedProduct}
            onEditProduct={handleEditProduct}
        />
      )}
       {selectedProduct && (
        <ViewProductDialog
            isOpen={isViewProductDialogOpen}
            setIsOpen={setIsViewProductDialogOpen}
            product={selectedProduct}
        />
      )}
    </main>
  );
}
