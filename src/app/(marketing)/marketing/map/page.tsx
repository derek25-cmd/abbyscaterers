"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "mapbox-gl/dist/mapbox-gl.css";
import type mapboxgl from "mapbox-gl";
import { AlertTriangle, Flame, MapPin, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  useCompanyMapPins, useHeatmapPoints, useLiveData, useMarketerLocations,
} from "@/features/marketing/hooks/useMarketingQuery";
import { getStageMeta, resolveStageMapColor } from "@/features/marketing/utils/pipeline";
import { formatDate, initials } from "@/features/marketing/utils/format";
import type { CompanyMapPin, MarketerLiveLocation } from "@/features/marketing/types";

const DAR_ES_SALAAM: [number, number] = [39.2083, -6.7924];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function isRecentlyActive(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 30 * 60 * 1000;
}

export default function LiveMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const marketerMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const companyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const [showMarketers, setShowMarketers] = useState(true);
  const [showCompanies, setShowCompanies] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const now = new Date();
  const [heatmapMonth, setHeatmapMonth] = useState(now.getMonth() + 1);
  const [heatmapYear] = useState(now.getFullYear());

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const { data: marketers, refetch: refetchMarketers } = useMarketerLocations();
  const { data: companyPins, refetch: refetchPins } = useCompanyMapPins();
  const { data: heatmapPoints } = useHeatmapPoints(heatmapMonth, heatmapYear, showHeatmap);
  const { data: live, refetch: refetchLive, dataUpdatedAt } = useLiveData();

  // Mount the map once — Mapbox GL needs browser APIs, so it's dynamically imported client-side only.
  useEffect(() => {
    if (!containerRef.current || !token) return;
    let cancelled = false;

    (async () => {
      const mapboxglModule = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxglModule.accessToken = token;

      const map = new mapboxglModule.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: DAR_ES_SALAAM,
        zoom: 11,
      });

      map.on("load", () => {
        map.addSource("visit-heatmap", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "visit-heatmap-layer",
          type: "heatmap",
          source: "visit-heatmap",
          layout: { visibility: "none" },
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": 1.2,
            "heatmap-radius": 24,
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.3, "rgba(251,191,36,0.5)",
              0.6, "rgba(249,115,22,0.7)",
              1, "rgba(220,38,38,0.9)",
            ],
          },
        });
        setMapReady(true);
      });

      map.on("error", (e) => setMapError(e.error?.message ?? "Map failed to load"));
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Marketer markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    marketerMarkersRef.current.forEach((m) => m.remove());
    marketerMarkersRef.current = [];
    if (!showMarketers || !marketers) return;

    (async () => {
      const mapboxglModule = (await import("mapbox-gl")).default;
      for (const marketer of marketers as MarketerLiveLocation[]) {
        if (marketer.last_latitude == null || marketer.last_longitude == null) continue;
        const active = isRecentlyActive(marketer.last_seen_at);

        const el = document.createElement("div");
        el.className = "marketing-marker-marketer" + (active ? " marketing-marker-marketer--active" : "");
        el.innerHTML = `<span>${escapeHtml(initials(marketer.full_name))}</span>` +
          (marketer.visits_today > 0 ? `<span class="marketing-marker-badge">${marketer.visits_today}</span>` : "");

        const popupHtml = `
          <div style="font-family:inherit;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(marketer.full_name)}</p>
            <p style="margin:0;font-size:12px;opacity:0.7">${escapeHtml(marketer.region_name ?? "No region")}</p>
            <p style="margin:4px 0 0;font-size:12px">Visits today: <b>${marketer.visits_today}</b></p>
            <p style="margin:2px 0 0;font-size:12px;opacity:0.7">Last seen: ${marketer.last_seen_at ? escapeHtml(formatDate(marketer.last_seen_at, "relative")) : "Unknown"}</p>
          </div>`;

        const marker = new mapboxglModule.Marker({ element: el })
          .setLngLat([marketer.last_longitude, marketer.last_latitude])
          .setPopup(new mapboxglModule.Popup({ offset: 16 }).setHTML(popupHtml))
          .addTo(map);
        marketerMarkersRef.current.push(marker);
      }
    })();
  }, [marketers, showMarketers, mapReady]);

  // Company markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    companyMarkersRef.current.forEach((m) => m.remove());
    companyMarkersRef.current = [];
    if (!showCompanies || !companyPins) return;

    (async () => {
      const mapboxglModule = (await import("mapbox-gl")).default;
      for (const pin of companyPins as CompanyMapPin[]) {
        const size = pin.lead_score >= 80 ? 18 : pin.lead_score >= 50 ? 14 : 10;
        const color = resolveStageMapColor(pin.pipeline_stage);

        const el = document.createElement("div");
        el.className = "marketing-marker-company";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundColor = color;

        const stageMeta = getStageMeta(pin.pipeline_stage);
        const popupHtml = `
          <div style="font-family:inherit;min-width:200px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(pin.name)}</p>
            <p style="margin:0 0 4px;font-size:12px">${escapeHtml(stageMeta.label)} · Score ${pin.lead_score}</p>
            <p style="margin:0;font-size:12px;opacity:0.7">${pin.marketer_name ? escapeHtml(pin.marketer_name) : "Unassigned"}</p>
            <p style="margin:2px 0 8px;font-size:12px;opacity:0.7">Last visited: ${pin.last_visited_at ? escapeHtml(formatDate(pin.last_visited_at, "relative")) : "Never"}</p>
            <a href="/marketing/companies/${pin.id}" style="font-size:12px;font-weight:600;color:hsl(var(--primary))">View Company →</a>
          </div>`;

        const marker = new mapboxglModule.Marker({ element: el })
          .setLngLat([pin.longitude, pin.latitude])
          .setPopup(new mapboxglModule.Popup({ offset: 12 }).setHTML(popupHtml))
          .addTo(map);
        companyMarkersRef.current.push(marker);
      }
    })();
  }, [companyPins, showCompanies, mapReady]);

  // Heatmap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty("visit-heatmap-layer", "visibility", showHeatmap ? "visible" : "none");
    if (!showHeatmap || !heatmapPoints) return;
    const source = map.getSource("visit-heatmap") as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: heatmapPoints.map((p) => ({
        type: "Feature",
        properties: { weight: p.weight },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    });
  }, [heatmapPoints, showHeatmap, mapReady]);

  const flyToMarketer = (marketer: MarketerLiveLocation) => {
    if (marketer.last_latitude == null || marketer.last_longitude == null) return;
    mapRef.current?.flyTo({ center: [marketer.last_longitude, marketer.last_latitude], zoom: 14 });
  };

  const refreshAll = () => {
    refetchMarketers();
    refetchPins();
    refetchLive();
  };

  const territoryChartData = useMemo(
    () => (live?.territoryCoverage ?? []).map((t) => ({ name: t.regionName, percent: t.coveragePercent })),
    [live]
  );

  if (!token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <p className="font-medium">Live map not configured</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add a Mapbox public token as <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment file to enable
            the live map. Get a free token at account.mapbox.com.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`
        .marketing-marker-marketer {
          width: 36px; height: 36px; border-radius: 9999px;
          background: hsl(var(--muted-foreground)); color: hsl(var(--background));
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; border: 2px solid hsl(var(--background));
          position: relative; cursor: pointer;
        }
        .marketing-marker-marketer--active {
          background: hsl(var(--primary));
          box-shadow: 0 0 0 0 hsl(var(--primary) / 0.6);
          animation: marketing-pulse 2s infinite;
        }
        @keyframes marketing-pulse {
          0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5); }
          70% { box-shadow: 0 0 0 10px hsl(var(--primary) / 0); }
          100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
        }
        .marketing-marker-badge {
          position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px;
          border-radius: 9999px; background: hsl(var(--destructive)); color: hsl(var(--destructive-foreground));
          font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 3px;
        }
        .marketing-marker-company {
          border-radius: 9999px; border: 2px solid hsl(var(--background)); cursor: pointer;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={showMarketers ? "secondary" : "outline"} onClick={() => setShowMarketers((v) => !v)}>
            <Users className="mr-1.5 h-3.5 w-3.5" /> Marketers
          </Button>
          <Button size="sm" variant={showCompanies ? "secondary" : "outline"} onClick={() => setShowCompanies((v) => !v)}>
            <MapPin className="mr-1.5 h-3.5 w-3.5" /> Companies
          </Button>
          <Button size="sm" variant={showHeatmap ? "secondary" : "outline"} onClick={() => setShowHeatmap((v) => !v)}>
            <Flame className="mr-1.5 h-3.5 w-3.5" /> Heat Map
          </Button>
          {showHeatmap && (
            <Select value={String(heatmapMonth)} onValueChange={(v) => setHeatmapMonth(Number(v))}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((label, i) => (
                  <SelectItem key={label} value={String(i + 1)}>{label} {heatmapYear}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {mapError && <Badge variant="destructive">{mapError}</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={containerRef} className="h-[600px] w-full overflow-hidden rounded-lg border" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Live Activity</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{dataUpdatedAt ? formatDate(new Date(dataUpdatedAt).toISOString(), "relative") : ""}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={refreshAll}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Marketers</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!live?.marketers.length ? (
                <p className="text-xs text-muted-foreground">No marketers with location data.</p>
              ) : (
                live.marketers.map((marketer) => {
                  const active = isRecentlyActive(marketer.last_seen_at);
                  return (
                    <button
                      key={marketer.id}
                      onClick={() => flyToMarketer(marketer)}
                      className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials(marketer.full_name)}
                      </span>
                      <span className="flex-1 truncate">{marketer.full_name}</span>
                      {active ? (
                        <Badge className="bg-success/15 text-success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Visit Activity Today</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!live?.todaysActivity.length ? (
                <p className="text-xs text-muted-foreground">No visits logged yet today.</p>
              ) : (
                live.todaysActivity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.companyName}</p>
                      <p className="truncate text-muted-foreground">{item.marketerName} · {formatDate(item.checkInTime, "relative")}</p>
                    </div>
                    {item.gpsVerified && <Badge className="shrink-0 bg-success/15 text-success">GPS</Badge>}
                  </div>
                ))
              )}
              <Link href="/marketing/companies" className="block pt-1 text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Territory Coverage</CardTitle></CardHeader>
            <CardContent>
              {territoryChartData.length === 0 ? (
                <p className="text-xs text-muted-foreground">No region data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={territoryChartData.length * 36 + 20}>
                  <BarChart data={territoryChartData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={90} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                    <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                      {territoryChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.percent > 80 ? "hsl(var(--success))" : entry.percent >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
