'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Search, Users, UserCheck, UserX, Briefcase, Loader2, FileDown, FileSpreadsheet } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog";
import { EditEmployeeDialog } from "@/components/hr/edit-employee-dialog";
import { ViewEmployeeDialog } from "@/components/hr/view-employee-dialog";
import { getEmployees, addEmployee, updateEmployee } from "@/services/employeeService";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/schemas";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";


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

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ABBY'S CATERERS — FULL STAFF DIRECTORY", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 25);
    doc.text(`Total Employees: ${employees.length}`, 14, 30);

    (doc as any).autoTable({
      startY: 36,
      theme: 'grid',
      head: [['ID', 'Name', 'Department', 'Role', 'Status', 'Email', 'Phone', 'Monthly Salary']],
      body: employees.map(emp => [
        emp.id,
        getFullName(emp),
        emp.department,
        emp.role,
        emp.status,
        emp.email || '-',
        emp.phone || '-',
        emp.monthlySalary ? emp.monthlySalary.toLocaleString() : '-'
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 12
      },
      headStyles: {
        font: 'helvetica',
        fontSize: 12,
        fillColor: [15, 23, 42],
        textColor: 255
      }
    });

    doc.save(`employee-directory-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Employees');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Department', key: 'department', width: 15 },
        { header: 'Role', key: 'role', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Monthly Salary', key: 'salary', width: 18 }
      ];

      employees.forEach(emp => {
        worksheet.addRow({
          id: emp.id,
          name: getFullName(emp),
          department: emp.department,
          role: emp.role,
          status: emp.status,
          email: emp.email || '-',
          phone: emp.phone || '-',
          salary: emp.monthlySalary || 0
        });
      });

      // Style all cells to Arial 12
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 12, bold: rowNumber === 1 };
          if (rowNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE2E8F0' } // slate/gray header background
            };
            cell.border = {
              bottom: { style: 'thin' }
            };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee-directory-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating Excel export:', error);
    }
  };


  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
            <h1 className="font-headline text-2xl font-bold">Employee Records</h1>
            <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExportPDF}>
                    <FileDown className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Export PDF
                    </span>
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Export Excel
                    </span>
                </Button>
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
                {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
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
                )) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No employees found matching the filters.</TableCell>
                    </TableRow>
                )}
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
