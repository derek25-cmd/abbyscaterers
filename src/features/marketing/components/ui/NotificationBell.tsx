"use client";

import { useRouter } from "next/navigation";
import { Bell, CalendarX, Flame, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarkNotificationsRead, useNotifications } from "../../hooks/useMarketingQuery";
import { formatDate } from "../../utils/format";
import type { MarketingNotification, NotificationType } from "../../types";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  HOT_LEAD: Flame,
  DEAL_WON: Trophy,
  FOLLOWUP_OVERDUE: CalendarX,
  FOLLOWUP_DUE_TODAY: CalendarX,
  QUOTATION_REQUESTED: TrendingUp,
  STAGE_CHANGE: TrendingUp,
  MARKETER_INACTIVE: Bell,
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function NotificationBell() {
  const router = useRouter();
  const { data: notifications } = useNotifications(true);
  const markRead = useMarkNotificationsRead();

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const todays = notifications?.filter((n) => isToday(n.createdAt)) ?? [];
  const earlier = notifications?.filter((n) => !isToday(n.createdAt)) ?? [];

  const handleClick = (notification: MarketingNotification) => {
    if (!notification.isRead) markRead.mutate({ ids: [notification.id] });
    if (notification.companyId) router.push(`/marketing/companies/${notification.companyId}`);
  };

  const renderGroup = (title: string, items: MarketingNotification[]) => {
    if (items.length === 0) return null;
    return (
      <div key={title} className="space-y-1">
        <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{title}</p>
        {items.map((notification) => {
          const Icon = TYPE_ICON[notification.type];
          return (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${!notification.isRead ? "border-l-2 border-primary" : ""}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{notification.title}</p>
                <p className="truncate text-xs text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground">{formatDate(notification.createdAt, "relative")}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="NotificationBell relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-destructive p-0 text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => markRead.mutate({ all: true })}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[480px] overflow-y-auto pb-2">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6" />
              No notifications
            </div>
          ) : (
            <>
              {renderGroup("Today", todays)}
              {renderGroup("Earlier", earlier)}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
