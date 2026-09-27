"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Comment, Group, Listing, Member, Place, Preferences, Profile, TravelTime, Vote } from "./types";

export type GroupData = {
  group: Group;
  members: Member[];
  profiles: Record<string, Profile>;
  prefs: Record<string, Preferences>;
  places: Place[];
  listings: Listing[];
  travelTimes: TravelTime[];
  votes: Vote[];
  comments: Comment[];
};

const REALTIME_TABLES = [
  "group_members",
  "preferences",
  "places",
  "listings",
  "travel_times",
  "votes",
  "comments",
] as const;

// Loads everything for the signed-in user's group, and reloads whenever a roommate changes something.
export function useGroupData(userId: string | undefined) {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: me, error: meErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (meErr) throw meErr;
      if (!me) {
        setData(null);
        return;
      }
      const g = me.group_id as string;
      const [group, members, prefs, places, listings, travel, votes, comments] = await Promise.all([
        supabase.from("groups").select("*").eq("id", g).single(),
        supabase.from("group_members").select("*").eq("group_id", g).order("joined_at"),
        supabase.from("preferences").select("*").eq("group_id", g),
        supabase.from("places").select("*").eq("group_id", g).order("created_at"),
        supabase.from("listings").select("*").eq("group_id", g).order("created_at", { ascending: false }),
        supabase.from("travel_times").select("*").eq("group_id", g),
        supabase.from("votes").select("*").eq("group_id", g),
        supabase.from("comments").select("*").eq("group_id", g).order("created_at"),
      ]);
      for (const r of [group, members, prefs, places, listings, travel, votes, comments]) if (r.error) throw r.error;
      const memberRows = members.data as Member[];
      const { data: profileRows, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", memberRows.map((m) => m.user_id));
      if (pErr) throw pErr;

      setData({
        group: group.data as Group,
        members: memberRows,
        profiles: Object.fromEntries((profileRows as Profile[]).map((p) => [p.id, p])),
        prefs: Object.fromEntries((prefs.data as Preferences[]).map((p) => [p.user_id, p])),
        places: places.data as Place[],
        listings: listings.data as Listing[],
        travelTimes: travel.data as TravelTime[],
        votes: votes.data as Vote[],
        comments: comments.data as Comment[],
      });
      setError(null);
    } catch (e) {
      setError(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not load your group.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after awaiting the network
    load();
  }, [load]);

  const groupId = data?.group.id;

  // Real-time: any change in this group triggers a (slightly delayed) reload.
  useEffect(() => {
    if (!groupId) return;
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 250);
    };
    let channel = supabase.channel(`group-${groupId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `group_id=eq.${groupId}` },
        scheduleReload,
      );
      // Supabase can't filter DELETE events, so listen to all deletes on the table as well.
      channel = channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, scheduleReload);
    }
    channel.subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [groupId, load]);

  return { data, loading, error, reload: load };
}

export function displayName(profiles: Record<string, Profile>, userId: string | null | undefined): string {
  if (!userId) return "Someone";
  const p = profiles[userId];
  return p?.full_name?.split(" ")[0] || p?.email?.split("@")[0] || "Roommate";
}
