"use client";

import { useState } from "react";
import { Bell, RefreshCw, CheckCheck, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppVersion } from "@/hooks/useAppVersion";
import { format } from "date-fns";

interface Notification {
  id: string;
  type: "update" | "info" | "warning";
  title: string;
  body: string;
  timestamp: Date;
  action?: { label: string; onClick: () => void };
  read: boolean;
}

export function NotificationCenter() {
  const { updateAvailable, refreshApp } = useAppVersion();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const notifications: Notification[] = [
    ...(updateAvailable
      ? [
          {
            id: "software-update",
            type: "update" as const,
            title: "Software Update Available",
            body: "A new version of Abby's Catersmart has been deployed. Apply the update now to get the latest features and fixes. Your session will be preserved.",
            timestamp: new Date(),
            action: {
              label: "Apply Update Now",
              onClick: () => {
                setOpen(false);
                refreshApp();
              },
            },
            read: readIds.has("software-update"),
          },
        ]
      : []),
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  const markRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  const iconMap = {
    update: <Zap className="h-4 w-4 text-amber-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />,
    warning: <Info className="h-4 w-4 text-orange-500" />,
  };

  const bgMap = {
    update: "bg-amber-50 border-amber-200",
    info: "bg-blue-50 border-blue-200",
    warning: "bg-orange-50 border-orange-200",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 p-0 shadow-xl border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <CheckCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No new notifications at the moment.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 transition-colors cursor-default",
                    !n.read && "bg-muted/20",
                    n.read && "opacity-70"
                  )}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "mt-0.5 h-8 w-8 rounded-full border flex items-center justify-center shrink-0",
                        bgMap[n.type]
                      )}
                    >
                      {iconMap[n.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{n.title}</p>
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                        {format(n.timestamp, "d MMM yyyy, HH:mm")}
                      </p>
                      {n.action && (
                        <Button
                          size="sm"
                          className="mt-2.5 h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            n.action!.onClick();
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          {n.action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            Updates are checked automatically every 5 minutes
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
