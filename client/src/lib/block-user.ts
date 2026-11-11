import { queryClient } from "@/lib/queryClient";

const AUTHOR_FEED_KEYS = [
  "/api/stories",
  "/api/signals",
  "/api/hub-posts",
  "/api/events",
  "/api/blog-posts",
  "/api/challenges/gallery",
  "/api/vibrapp/messages",
];

export function hideBlockedProfileFromFeeds(profileId: string) {
  for (const queryKey of AUTHOR_FEED_KEYS) {
    queryClient.setQueriesData<any[]>({ queryKey: [queryKey] }, (old) =>
      Array.isArray(old) ? old.filter((item) => item?.profileId !== profileId) : old
    );
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }

  queryClient.setQueriesData<any[]>({ queryKey: ["/api/profiles/swipable"] }, (old) =>
    Array.isArray(old) ? old.filter((profile) => profile?.id !== profileId) : old
  );
  queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });

  queryClient.setQueriesData<{ profiles: any[] }>({ queryKey: ["/api/feed/videos"] }, (old) =>
    old && Array.isArray(old.profiles)
      ? { ...old, profiles: old.profiles.filter((profile) => profile?.id !== profileId) }
      : old
  );
  queryClient.invalidateQueries({ queryKey: ["/api/feed/videos"] });
}
