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
    <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ to, label, Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground data-[status=active]:text-primary">
            <Icon className="h-5 w-5" />
            {label}
            {to === "/" && status === "recording" && <span className="absolute right-[30%] top-2 h-2 w-2 animate-pulse rounded-full bg-destructive" />}
          </Link>
        ))}
      </div>
    </nav>
  );
}
