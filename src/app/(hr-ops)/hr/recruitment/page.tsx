// @ts-nocheck
'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { AddJobDialog } from "@/components/hr/add-job-dialog";
import { EditJobDialog } from "@/components/hr/edit-job-dialog";
import { ViewJobDialog } from "@/components/hr/view-job-dialog";
import { getPositions, addPosition, updatePosition } from "@/services/recruitmentService";

export default function RecruitmentPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddJobDialogOpen, setIsAddJobDialogOpen] = useState(false);
  const [isEditJobDialogOpen, setIsEditJobDialogOpen] = useState(false);
  const [isViewJobDialogOpen, setIsViewJobDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  useEffect(() => {
    const fetchPositions = async () => {
      const positionsData = await getPositions();
      setPositions(positionsData);
      setLoading(false);
    };
    fetchPositions();
  }, []);

  const handleAddJob = async (newPosition) => {
    const positionToAdd = {
      ...newPosition,
      applicants: 0,
    };
    const newId = await addPosition(positionToAdd);
    setPositions(prevPositions => [{ id: newId, ...positionToAdd }, ...prevPositions]);
  };

  const handleEditJob = async (updatedPosition) => {
    await updatePosition(updatedPosition.id, updatedPosition);
    setPositions(prevPositions => 
      prevPositions.map(p => p.id === updatedPosition.id ? updatedPosition : p)
    );
  };

  const openEditDialog = (position) => {
    setSelectedPosition(position);
    setIsEditJobDialogOpen(true);
  };

  const openViewDialog = (position) => {
    setSelectedPosition(position);
    setIsViewJobDialogOpen(true);
  };

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Recruitment</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddJobDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                New Job Posting
              </span>
            </Button>
          </div>
        </div>
        {loading ? (
            <p>Loading job positions...</p>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {positions.map((position) => (
            <Card key={position.id}>
              <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-4 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="font-headline text-xl">{position.title}</CardTitle>
                  <CardDescription>
                    {position.department} • {position.location}
                  </CardDescription>
                </div>
                <div className="flex items-center rounded-md text-secondary-foreground">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(position)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(position)}>Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground">
                    <div className="flex items-center">
                        <Users className="mr-1 h-4 w-4 fill-primary text-primary" />
                        {position.applicants} Applicants
                    </div>
                    <div>
                        <Badge variant="outline">{position.type}</Badge>
                    </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">View Applicants</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        )}
      
      <AddJobDialog
        isOpen={isAddJobDialogOpen}
        setIsOpen={setIsAddJobDialogOpen}
        onAddJob={handleAddJob}
      />
      {selectedPosition && (
        <EditJobDialog
          isOpen={isEditJobDialogOpen}
          setIsOpen={setIsEditJobDialogOpen}
          position={selectedPosition}
          onEditJob={handleEditJob}
        />
      )}
      {selectedPosition && (
        <ViewJobDialog
          isOpen={isViewJobDialogOpen}
          setIsOpen={setIsViewJobDialogOpen}
          position={selectedPosition}
        />
      )}
    </main>
  );
}
