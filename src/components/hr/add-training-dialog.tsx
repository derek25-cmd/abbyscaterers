// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { getEmployees } from "@/services/employeeService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";

export function AddTrainingDialog({ isOpen, setIsOpen, onAddTraining }) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Skill Training');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainer_name, setTrainerName] = useState('');
  const [description, setDescription] = useState('');
  
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchEmployees = async () => {
        setLoadingEmployees(true);
        const data = await getEmployees();
        setEmployees(data);
        setLoadingEmployees(false);
      };
      fetchEmployees();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setDepartment('');
    setLocation('');
    setType('Skill Training');
    setTrainingDate(new Date().toISOString().split('T')[0]);
    setTrainerName('');
    setDescription('');
    setSelectedEmployees([]);
    setSearchQuery('');
  }

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!title || !department || !location) {
        alert("Please fill all required fields");
        return;
    }

    onAddTraining({
      title,
      department,
      location,
      type,
      training_date: trainingDate,
      trainer_name,
      description,
      employeeIds: selectedEmployees
    });

    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Training Session</DialogTitle>
            <DialogDescription>
              Enter training details and assign multiple employees.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Column: Details */}
            <div className="space-y-4">
               <div>
                  <Label htmlFor="title">Topic</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Food Safety" />
               </div>
               <div>
                  <Label htmlFor="trainingDate">Training Date</Label>
                  <Input id="trainingDate" type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} />
               </div>
               <div>
                  <Label htmlFor="department">Managing Department</Label>
                  <Select onValueChange={setDepartment} value={department}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kitchen">Kitchen</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Logistics">Logistics</SelectItem>
                      <SelectItem value="Service Staff">Service Staff</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
               </div>
               <div>
                  <Label htmlFor="type">Training Type</Label>
                  <Select onValueChange={setType} value={type}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a training type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Skill Training">Skill Training</SelectItem>
                      <SelectItem value="Orientation">Orientation</SelectItem>
                      <SelectItem value="Compliance">Compliance</SelectItem>
                      <SelectItem value="Refresher">Refresher</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label htmlFor="trainer">Trainer Name</Label>
                  <Input id="trainer" value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} placeholder="Full Name" />
               </div>
               <div className="md:col-span-2">
                  <Label htmlFor="description">Training Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the module" />
               </div>
            </div>

            {/* Right Column: Employee Selection */}
            <div className="flex flex-col space-y-2">
               <Label>Assign Staff ({selectedEmployees.length} selected)</Label>
               <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search staff or department..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               
               <div className="border rounded-md p-2 bg-muted/20">
                  <ScrollArea className="h-[250px]">
                    {loadingEmployees ? (
                        <div className="flex justify-center items-center h-full py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-2 pr-4">
                            {filteredEmployees.map(emp => (
                                <div key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-background transition-colors border border-transparent hover:border-border">
                                    <Checkbox 
                                        id={`emp-${emp.id}`} 
                                        checked={selectedEmployees.includes(emp.id)}
                                        onCheckedChange={() => toggleEmployee(emp.id)}
                                    />
                                    <Label htmlFor={`emp-${emp.id}`} className="flex flex-col cursor-pointer flex-1">
                                        <span className="font-bold text-sm tracking-tight">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground font-black">{emp.department} • {emp.role}</span>
                                    </Label>
                                </div>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">No staff found</div>
                            )}
                        </div>
                    )}
                  </ScrollArea>
               </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={selectedEmployees.length === 0}>
               Schedule with {selectedEmployees.length} Participants
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
