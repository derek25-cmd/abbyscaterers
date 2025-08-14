// @ts-nocheck
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Box, Truck, Users, ArrowUpRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from 'react';
import { getProducts } from "@/services/productService";
import { getIssuances } from "@/services/issuanceService";
import { getEmployees } from "@/services/employeeService";
import { getPositions } from "@/services/recruitmentService";

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [stock, setStock] = useState([]);
    const [issuanceLog, setIssuanceLog] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [openPositions, setOpenPositions] = useState([]);
    const [recentIssuances, setRecentIssuances] = useState([]);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [productsData, issuanceData, employeesData, positionsData] = await Promise.all([
                getProducts(),
                getIssuances(),
                getEmployees(),
                getPositions()
            ]);

            setStock(productsData);
            setIssuanceLog(issuanceData);
            setEmployees(employeesData);
            setOpenPositions(positionsData);

            // Create recent issuances with employee details
            const issuancesWithEmployee = issuanceData
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .map(issuance => {
                    const employee = employeesData.find(e => e.name === issuance.issuedTo);
                    return {
                        id: issuance.id,
                        item: issuance.name,
                        employee: { 
                            name: issuance.issuedTo, 
                            role: employee ? employee.role : 'N/A' 
                        },
                        date: issuance.date,
                    };
                });
            setRecentIssuances(issuancesWithEmployee);
            
            setLoading(false);
        }
        fetchData();
    }, []);

  const lowStockItems = stock.filter(item => item.quantity < item.minStock).length;
  const outOfStockItems = stock.filter(item => item.quantity === 0).length;
  const assetsOnLoan = issuanceLog.filter(log => log.status === 'Issued').length;
  const totalEmployees = employees.length;

  if (loading) {
      return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h2>
                <p>Loading dashboard data...</p>
            </div>
        </AppLayout>
      );
  }

  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Employees
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                +5 since last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Assets on Loan
              </CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assetsOnLoan}</div>
              <p className="text-xs text-muted-foreground">
                Updated in real-time
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems}</div>
              <p className="text-xs text-muted-foreground">
                {outOfStockItems} items out of stock
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openPositions.length}</div>
              <p className="text-xs text-muted-foreground">
                1 new posting this week
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentIssuances.map((issuance) => (
                    <TableRow key={issuance.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                             <AvatarImage src={`https://i.pravatar.cc/40?u=${issuance.employee.name}`} alt={issuance.employee.name} />
                             <AvatarFallback>{issuance.employee.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <div>
                            <div className="font-medium">{issuance.employee.name}</div>
                            <div className="text-sm text-muted-foreground">{issuance.employee.role}</div>
                           </div>
                         </div>
                      </TableCell>
                      <TableCell>{issuance.item}</TableCell>
                      <TableCell className="text-right">{issuance.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                    <CardTitle>Open Job Positions</CardTitle>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/hr/recruitment">
                        View All
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="grid gap-6">
              {openPositions.slice(0, 4).map((position) => (
                <div key={position.id} className="flex items-center justify-between space-x-4">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={`https://placehold.co/40x40.png`} data-ai-hint="logo" />
                      <AvatarFallback>{position.title.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{position.title}</p>
                      <p className="text-sm text-muted-foreground">{position.department}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{position.type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
