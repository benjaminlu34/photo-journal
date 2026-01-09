# Frontend Bug Audit

This document captures high-level, hard-to-spot defects observed in the Photo Journal frontend. Each item includes the impacted code, why it is problematic, and suggested follow-ups.

## 1. Weekly calendar is permanently locked to the first loaded week
- **Where:** `client/src/lib/calendar-store.ts` lines 77-109 and `client/src/contexts/calendar-context.tsx` lines 96-108.
- **What happens:** `useCalendarStore().actions.init` sets up the Yjs/WebRTC document for a specific ISO week. It bails out whenever the store has already been initialized for the current user (`if (state.isInitialized && state.userId === userId) return;`). There is no comparison against the requested `weekId`. After the first call, subsequent attempts to navigate to another week never rehydrate the store or swap the CRDT document, so `localEvents` keep reflecting the very first week that was loaded.
- **Why it is hard to detect:** The UI still updates `currentWeek`, so headers/date pickers reflect the newly selected week while the content silently shows stale data. Unless you cross-check events across weeks you might assume the week has no events.
- **How to reproduce:** Switch to *Weekly Calendar* view, create an event, then use the navigation buttons to move to the next week. The new week still shows the previous week's event, and creating a new event overwrites data in the original week because the underlying Yjs map never changed.
- **Fix direction:** Track the active `weekId` in state and include it in the `init` short-circuit. When `initialDate` changes, destroy the current SDK (with `sdk.destroy()` and snapshot teardown) and instantiate a fresh `getCalendarSdk` for the new week.
- **Status:** ✅ Fixed by tracking the loaded `weekId` inside the calendar store, tearing down the previous SDK whenever the user navigates to a different week, and spinning up a fresh Yjs/WebRTC provider for the new period.

## 2. Calendar connectivity indicator always reports "online"
- **Where:** `client/src/contexts/calendar-context.tsx` lines 74-90.
- **What happens:** `isConnected` is derived from `sdk.presence.getStates().size > 0`. Awareness always contains the local client's state, even when disconnected, so the count is never zero. The "Offline mode" chip therefore never appears, and participants are told they are connected even if the WebRTC provider has dropped.
- **Why it is hard to detect:** When testing alone the indicator always shows "connected". Only by running the app offline (e.g., disabling network) and checking the console do you notice the discrepancy.
- **Fix direction:** Listen to `provider.on('status', …)` or `provider.on('synced', …)` from y-webrtc/y-protocols and/or inspect `provider.wsconnected` instead of the awareness roster.
- **Status:** ✅ Fixed by exposing the WebRTC provider's status via the calendar SDK, wiring `CalendarProvider` to that signal, and falling back to awareness-based detection only if the runtime lacks the new helper.

## 3. Real-time friendship features are effectively disabled
- **Where:** `client/src/hooks/useFriendshipEvents.ts` (lines 92-109 & 210-223), `client/src/components/friends/friendship-notifications.tsx`, `client/src/components/friendship/FriendshipImageHandler.tsx`.
- **What happens:**
  - The WebSocket effect is currently short-circuited with a TODO (`console.log('…temporarily disabled…')`) so `connect()` is never invoked. No real-time events are received anywhere in the UI.
  - Even if the guard were removed, the authentication payload still sends `token: 'placeholder-token'`, so the server will reject the connection.
  - Components that rely on these hooks (`FriendshipNotifications` for toasts/badge counts and `FriendshipImageHandler` for refreshing signed URLs when permissions change) silently never fire.
- **Why it is hard to detect:** The notifications UI loads historical items from `localStorage`, so in manual QA it looks populated even though new events never arrive. Similarly, shared image access appears fine until friend permissions change and caches are never invalidated.
- **Fix direction:** Re-enable the connection logic once throttling is addressed, send the actual Supabase JWT (from `supabase.auth.getSession()`), and bubble connection status so dependent components can show an error state when the socket can’t authenticate.
- **Status:** ✅ Fixed by restoring the WebSocket lifecycle, authenticating with the Supabase access token, and reconnecting with backoff so notifications and permission refreshes now fire in real time.

## 4. Friend list pagination cannot ever load page 2
- **Where:** `client/src/components/friends/friend-list.tsx` lines 103-137 & 340-351.
- **What happens:** The `cursor` state is never included in the React Query `queryKey`, so changing it would not trigger a refetch. Compounding that, the "Load More" button is currently a stub that only fires a toast (`// TODO: Implement pagination`). As a result the `pagination.hasMore` flag coming from the API is unusable—the UI is hard‑coded to the first 20 friends.
- **Why it is hard to detect:** With small seed datasets the list appears to work. Only accounts that exceed the page size will realize they can’t scroll further.
- **Fix direction:** Include the cursor in the `queryKey`, actually call `setCursor(friendsData.pagination.nextCursor)` (or similar) when `Load More` is clicked, and trigger `queryClient.fetchQuery`/`refetch` so the subsequent page is requested.
- **Status:** ✅ Fixed by moving the friends query to `useInfiniteQuery`, appending additional pages when "Load More" is pressed, and showing a spinner while the next batch streams in.

## 5. "Add First Note" call-to-action is dead
- **Where:** `client/src/components/journal/workspace/workspace.tsx` lines 33-46.
- **What happens:** When a user has no `currentEntry`, the view shows a "Begin Your Story" panel with an "Add First Note" button. The button handler is `onClick={() => {}}`, so it never creates an entry, never navigates, and never opens the note composer. New users reach a dead end.
- **Why it is hard to detect:** Most manual tests are done with seed data, so this empty-state branch is seldom exercised.
- **Fix direction:** Wire this button to the same creation flow as the "new note" action in StickyBoard (e.g., call the board store `create` action after ensuring a journal entry exists or redirect to the `/welcome` onboarding flow that collects an initial note).
- **Status:** ✅ Fixed by giving the empty state access to the journal refetcher, auto-creating the entry via the existing API, and surfacing clear feedback (or a "view-only" message) depending on whether the user owns the board.

---

These defects span collaboration, social, and onboarding flows. Addressing them will unblock core user journeys (editing different weeks, getting live friend updates, and onboarding without existing entries). Let me know if you want deeper dives or proposed patches for any specific item.
