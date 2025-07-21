
"use client"; 

import { DailyMenuForm } from "@/components/daily-menus/daily-menu-form";
import { BookOpen } from "lucide-react";

export default function NewDailyMenuPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <DailyMenuForm />
    </div>
  );
}
