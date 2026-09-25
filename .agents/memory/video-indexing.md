---
name: Public video SEO
description: Project-specific guidance for Google indexing video thumbnails on public SPA routes.
---

Public SPA pages that contain video need their thumbnail URL in the initial HTML response; client-side metadata updates alone may not be available when Google first inspects the page. Use an absolute, publicly reachable thumbnail URL and emit video metadata only on routes that visibly contain the video.

Do not invent a video upload date to satisfy structured-data fields. Use structured video data only when the actual upload timestamp is available; otherwise provide the real thumbnail through page metadata and the visible video poster.

**Why:** Search crawlers may inspect the initial shell before running the client bundle, and a fabricated date would make the page data inaccurate.

**How to apply:** For each public video route, verify the exact URL returns the thumbnail metadata in its first HTML response and the thumbnail itself is publicly reachable. After publishing, request a fresh inspection for the precise Search Console URL.