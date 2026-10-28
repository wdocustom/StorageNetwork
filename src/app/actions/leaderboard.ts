"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getLeaderboard, type LeaderboardData } from "@/lib/server/leaderboard";

/** The monthly leaderboard, with the signed-in installer's own position. */
export async function getMyLeaderboard(): Promise<LeaderboardData | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  return getLeaderboard(user.id);
}
