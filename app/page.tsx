import { Suspense } from "react";
import HomeInner from "./HomeInner";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00E273] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}