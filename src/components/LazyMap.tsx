import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type TrackMapType from "./TrackMap";

const TrackMap = lazy(() => import("./TrackMap"));
const Fallback = () => <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">Loading map…</div>;

export function LazyMap(props: ComponentProps<typeof TrackMapType>) {
  return <ClientOnly fallback={<Fallback />}><Suspense fallback={<Fallback />}><TrackMap {...props} /></Suspense></ClientOnly>;
}
