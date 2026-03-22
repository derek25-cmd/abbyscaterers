'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Search, Users, UserCheck, UserX, Briefcase, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog";
import { EditEmployeeDialog } from "@/components/hr/edit-employee-dialog";
import { ViewEmployeeDialog } from "@/components/hr/view-employee-dialog";
import { getEmployees, addEmployee, updateEmployee } from "@/services/employeeService";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/schemas";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [isEditEmployeeDialogOpen, setIsEditEmployeeDialogOpen] = useState(false);
  const [isViewEmployeeDialogOpen, setIsViewEmployeeDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      const employeesData = await getEmployees();
      setEmployees(employeesData);
      setLoading(false);
    };
    fetchEmployees();
  }, []);
  
  const getFullName = (employee: any) => {
    return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
        const matchesSearch = searchQuery ? getFullName(employee).toLowerCase().includes(searchQuery.toLowerCase()) : true;
        const matchesDept = departmentFilter !== 'all' ? employee.department === departmentFilter : true;
        const matchesStatus = statusFilter !== 'all' ? employee.status === statusFilter : true;
        return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
        total: employees.length,
        active: employees.filter(e => e.status === 'Active').length,
        inactive: employees.filter(e => e.status !== 'Active').length,
    }
  }, [employees]);

  const handleAddEmployee = async (newEmployee: any) => {
    const result = await addEmployee(newEmployee);
    if(result) setEmployees(prevEmployees => [result, ...prevEmployees]);
  };
  
  const handleEditEmployee = async (updatedEmployee: any) => {
    await updateEmployee(updatedEmployee.id, updatedEmployee);
    setEmployees(prevEmployees => 
        prevEmployees.map(employee => 
            employee.id === updatedEmployee.id ? updatedEmployee : employee
        )
    );
  };

  const openEditDialog = (employee: any) => {
    setSelectedEmployee(employee);
    setIsEditEmployeeDialogOpen(true);
  };
  
  const openViewDialog = (employee: any) => {
    setSelectedEmployee(employee);
    setIsViewEmployeeDialogOpen(true);
  };


  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
            <h1 className="font-headline text-2xl font-bold">Employee Records</h1>
            <div className="ml-auto flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddEmployeeDialogOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Employee
                    </span>
                </Button>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                    <UserX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Staff Directory</CardTitle>
            <CardDescription>
              Manage and view details for all company personnel.
            </CardDescription>
          </CardHeader>
           <div className="p-6 pt-0 flex flex-col md:flex-row items-center gap-2">
              <div className="relative flex-1 md:grow-0 w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8"
                />
              </div>
               <Select onValueChange={setDepartmentFilter} value={departmentFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                </SelectContent>
              </Select>
               <Select onValueChange={setStatusFilter} value={statusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
          </div>
          <CardContent>
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{getFullName(employee)}</TableCell>
                    <TableCell>{employee.role}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'Active' ? 'default' : 'outline'}
                        className={employee.status === 'Active' ? 'bg-accent text-accent-foreground' : ''}>
                        {employee.status}
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
                          <DropdownMenuItem onClick={() => openViewDialog(employee)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(employee)}>Edit</DropdownMenuItem>
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
      
      <AddEmployeeDialog 
        isOpen={isAddEmployeeDialogOpen}
        setIsOpen={setIsAddEmployeeDialogOpen}
        onAddEmployee={handleAddEmployee}
      />
      {selectedEmployee && (
        <EditEmployeeDialog
            isOpen={isEditEmployeeDialogOpen}
            setIsOpen={setIsEditEmployeeDialogOpen}
            employee={selectedEmployee}
            onEditEmployee={handleEditEmployee}
        />
      )}
      {selectedEmployee && (
        <ViewEmployeeDialog
            isOpen={isViewEmployeeDialogOpen}
            setIsOpen={setIsViewEmployeeDialogOpen}
            employee={selectedEmployee}
        />
      )}
    </main>
  );
}
