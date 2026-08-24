'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Search, FileText, Loader2, User, Calendar, Lock, Unlock, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getSupervisorReports } from "@/services/supervisorReportService";
import type { SupervisorReport } from "@/types";

export default function SupervisorReportsPage() {
  const [reports, setReports] = useState<SupervisorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const data = await getSupervisorReports();
      setReports(data);
      setLoading(false);
    };
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter(r => 
      r.supervisor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.prepared_by.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reports, searchQuery]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Supervisor Daily Reports</h1>
          <p className="text-muted-foreground">Monitor daily kitchen operations and quality compliance.</p>
        </div>
        <Button asChild>
          <Link href="/reports/supervisor-daily/new">
            <PlusCircle className="mr-2 h-4 w-4" /> New Report
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>History</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by supervisor or preparer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Prepared By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.length > 0 ? filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(parseISO(report.report_date), 'PPP')}
                    </TableCell>
                    <TableCell>{report.supervisor_name}</TableCell>
                    <TableCell>{report.prepared_by}</TableCell>
                    <TableCell>
                      <Badge variant={report.status === 'Submitted' ? 'default' : 'outline'} className={report.status === 'Submitted' ? 'bg-green-600' : ''}>
                        {report.status === 'Submitted' ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reports/supervisor-daily/${report.id}`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View / {report.status === 'Draft' ? 'Edit' : 'PDF'}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      No supervisor reports found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
