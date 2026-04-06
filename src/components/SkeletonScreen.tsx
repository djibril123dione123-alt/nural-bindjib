import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonScreen() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Cards */}
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}
