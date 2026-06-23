import { SurfScoringLab } from "@/components/SurfScoringLab";
import { getAppState } from "@/lib/db";

export default function Home() {
  return <SurfScoringLab initialState={getAppState()} />;
}

export const dynamic = "force-dynamic";
