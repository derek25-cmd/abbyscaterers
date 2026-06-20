import { format, formatDistanceToNow, isBefore, isSameDay, startOfDay } from 'date-fns';

export function formatTZS(amount: number | null | undefined, opts?: { compact?: boolean }): string {
  const value = amount ?? 0;

  if (opts?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `TZS ${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `TZS ${(value / 1_000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(value);
}

export function formatDate(date: string | Date, mode: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (mode === 'relative') return formatRelative(d);
  if (mode === 'long') return format(d, 'dd MMMM yyyy');
  return format(d, 'dd MMM yyyy');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy, HH:mm');
}

export function isOverdue(dueDateIso: string): boolean {
  return isBefore(new Date(dueDateIso), startOfDay(new Date()));
}

export function isDueToday(dueDateIso: string): boolean {
  return isSameDay(new Date(dueDateIso), new Date());
}

/** Haversine distance between two GPS points, in meters. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GpsAccuracyTag = 'VERIFIED' | 'APPROXIMATE' | 'UNVERIFIED';

export function gpsVerificationTag(tag: GpsAccuracyTag | null | undefined): { label: string; color: string } {
  switch (tag) {
    case 'VERIFIED':
      return { label: 'GPS Verified', color: 'bg-success/15 text-success' };
    case 'APPROXIMATE':
      return { label: 'Approximate', color: 'bg-warning/15 text-warning' };
    default:
      return { label: 'Unverified', color: 'bg-muted text-muted-foreground' };
  }
}

export function formatTanzanianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `255${digits.slice(1)}` : digits;
  if (normalized.length !== 12) return phone;
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface TrendResult {
  direction: 'up' | 'down' | 'flat';
  percent: number;
  label: string;
}

export function formatTrend(current: number, previous: number): TrendResult {
  if (previous === 0) {
    if (current === 0) return { direction: 'flat', percent: 0, label: '0%' };
    return { direction: 'up', percent: 100, label: 'New' };
  }

  const percent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  return { direction, percent: Math.abs(percent), label: `${percent > 0 ? '+' : ''}${percent}%` };
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
