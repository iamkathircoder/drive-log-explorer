import { Link } from "@tanstack/react-router";
import { Gauge, Map, List, Settings } from "lucide-react";
import { useRecorder } from "@/lib/recorder";

const items = [
  { to: "/", label: "Record", Icon: Gauge },
  { to: "/map", label: "Map", Icon: Map },
  { to: "/tracks", label: "Tracks", Icon: List },
  { to: "/settings", label: "Settings", Icon: Settings },
] as const;

export function BottomNav() {
  const { status } = useRecorder();
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-[1000] bg-surface-container pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto grid h-20 max-w-lg grid-cols-4">
        {items.map(({ to, label, Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }} className="m3-touch group flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground data-[status=active]:text-foreground">
            <span className="relative flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200 group-data-[status=active]:bg-primary-container group-data-[status=active]:text-on-primary-container">
              <Icon className="h-6 w-6" />
              {to === "/" && status === "recording" && <span aria-label="Recording" className="absolute right-2 top-1 h-2 w-2 animate-pulse rounded-full bg-destructive ring-2 ring-surface-container" />}
            </span>
            <span className="leading-4 group-data-[status=active]:font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
