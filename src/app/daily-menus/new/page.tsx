
"use client"; 

import { DailyMenuForm } from "@/components/daily-menus/daily-menu-form";
import { BookOpen } from "lucide-react";

export default function NewDailyMenuPage() {
  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
         <BookOpen className="mr-2 h-7 w-7 text-primary" /> Add New Daily Menu
        </h1>
      <DailyMenuForm />
    </div>
  );
}
