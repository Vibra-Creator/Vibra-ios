# Vibra - Dating App with Alien Theme

## Overview
Vibra is a Tinder-like dating app with a unique alien/space theme. Users can swipe through profiles of alien beings, match with compatible profiles, chat with matches, and fully customize their profile. Features admin dashboard for moderation and profile verification.

## Features
- **Swipe Cards**: Drag-to-swipe interface similar to Tinder
- **Match System**: When two users like each other, a match is created
- **Real-time Chat**: Chat with your matches in a beautiful chat interface
- **User Profile**: Create and edit your own alien profile with 20+ customization fields, choose profile photo from gallery
- **Persistent Photo Storage**: All uploaded photos (profile + challenges) stored in Replit Object Storage (cloud-persistent)
- **Verified Profiles**: Admin can verify profiles (blue checkmark badge)
- **Admin Dashboard**: Statistics, user management, profile moderation
- **Alien Theme**: Cosmic color scheme with purple, cyan, and pink glows
- **Video Background Support**: Animated starfield background
- **Generated Profile Images**: AI-generated realistic portraits for bot profiles (90 bots: 50 Italian, 20 English US/UK, 20 Spanish-speaking)
- **AI Bot Chat**: Bot profiles automatically reply to user messages using OpenAI AI with personality-aware responses
- **PWA Support**: Installable on mobile devices as a standalone app
- **Email/Password Auth**: Custom authentication with bcrypt password hashing and session management
- **Split Registration Flow**: Registration collects only essentials (name, email, password, gender, age) then auto-creates a basic profile with defaults. User goes straight to Home to start swiping. A banner prompts profile completion. Full profile editing available from Profile page.
- **Interest Rooms**: Join public chat rooms based on interests (Stanze)
- **Daily Challenges**: Complete photo challenges to earn points (Sfide Giornaliere)
- **Virtual Gifts**: Spend earned points to send animated gifts to other users (Regali Virtuali)
- **Private Rooms**: Create exclusive private rooms with access approval system (Stanze Private) - limit 1 per user, categorized view (La Mia Stanza, Stanze dei Match, Popolari), "Stanza VIP" badge on swipe cards
- **Prima Impressione**: Rating system where users can opt-in to receive 1-10 ratings from others on their swipe card. Rated users see ratings in dedicated page, can reply with one message which auto-creates a match and opens chat
- **Sto Vibing Ora**: Live presence mode - activate for 30 minutes to see only nearby active users (1-10 km radius) who are also vibing. Uses browser geolocation, Haversine distance calculation, countdown timer, auto-expires
- **Distance Filtering**: Profiles filtered by distance (5-200km slider). City coordinates auto-set from Italian cities database. Haversine formula calculates real distances between users.
- **Guest Mode (Modalità Ospite)**: Browse the entire app without registering. See all profiles, rooms, challenges, and features in read-only mode. Interactions (swipe, chat, join rooms) blocked with registration prompt modal. Guest state stored in sessionStorage, public API endpoints at /api/guest/*
- **Referral System (Procacciatore)**: Users get auto-generated VBR-XXXXX invite codes, can share via profile page. New users enter code during registration. Referrer earns 50 points per signup. Admin dashboard shows all referrers, their invited users, and paid status.
  - Admin can set discount % for invited users and commission % for referrers via admin dashboard (Impostazioni Percentuali)
  - All user referral codes visible in admin "Codici Utenti" section
  - Settings stored in app_settings table (key-value)
- **Weekly Challenge Leaderboard**: Top 10 ranking on challenges page showing profiles with most approved challenge points. Top 3 displayed with gold/silver/bronze medals, positions 4-10 in vertical list. Current user highlighted.
- **Live Room Activity**: Each room card shows pulsing green dot with active member count ("X attivi ora"). Rooms never appear empty (deterministic base count). FOMO animation for rooms with 3+ active users.
- **Profilo in Evidenza**: Winning a challenge worth 60+ points automatically highlights the profile for 7 days with golden glowing border and "In Evidenza" badge. Highlighted profiles appear first in swipe queue. Admin can manually highlight/unhighlight any profile (Crown button in admin dashboard).
- **Auto Backup**: Automatic daily database backup to Object Storage. Exports all 22 tables as JSON. Admin can trigger manual backups and view backup history from dashboard. Keeps last 7 backups, auto-deletes older ones.
- **Activity Feed (Engagement System)**: Live activity notifications on home page to make the app feel alive. Includes: (1) OnlineBanner showing animated count of active users, (2) ActivityToastSystem with timed toast notifications about profile visits, compatibility matches, room activity, and nearby vibers. Events generated using bot profiles. Fully translated IT/EN/ES.
- **Vibration Activity (Personal Dashboard)**: Collapsible card on home page showing personalized engagement metrics: "X hanno percepito la tua vibrazione", "X energie compatibili vicine", "X volte il tuo profilo è stato mostrato oggi", "X nuove compatibilità rilevate". Numbers mix deterministic daily seeds with real swipe data. Creates daily return habit. Fully translated IT/EN/ES.
- **Admin Stats (Real Only)**: Admin dashboard counters exclude bot data - shows only real user profiles, matches, and messages.
- **Vibrapp (Global Chat)**: WhatsApp-like global chat room using Socket.io for real-time messaging. Features: message bubbles, typing indicators ("sta scrivendo..."), read receipts (blue double check), emoji reactions (❤️😂😮😢🔥👍), reply to messages, scroll to load older messages, online user count. Server-side session authentication for Socket.io. Welcome banner on home page for new users. **Private replies**: when you reply to someone's message, the reply is visible ONLY to you and the original author (purple Lock icon, targeted Socket.io rooms, DB-level filtering via replyToSenderId). Read receipts and reactions on private replies are also scoped to the two participants. **Media uploads**: users can attach images (max 20MB) or short videos (max 10s / 60MB) via 📎 button; files stored in object storage; images shown inline with lightbox; videos with native player. DB columns: media_url, media_type. Endpoint: POST /api/vibrapp/request-upload. Fully translated IT/EN/ES. Route: /vibrapp. DB table: vibrapp_messages.
- **Welcome Email Service**: Gmail integration (privacyvibra@gmail.com) sends themed welcome emails. Auto-sends on new user registration. Admin can bulk-send to all existing users from admin dashboard "Email" tab. Uses Replit Google Mail connector with OAuth. File: server/gmail.ts.
- **Web Push Notifications**: Targeted push notifications using Web Push API (web-push npm package). Users opt-in from profile page (Bell icon button). Notifications sent only for: (1) replies to user's Vibrapp messages, (2) new private match chat messages. NOT for every global chat message. DB table: push_subscriptions. Service worker handles push events and notification click navigation. VAPID keys stored as env vars. Fully translated IT/EN/ES.
- **Social Dating - Profile Videos**: Users can upload up to 2 short profile videos (max 30s / 50MB each, formats: mp4/webm/mov). AI-powered content moderation via OpenAI vision API (gpt-4o-mini) analyzes first frame thumbnail to block nudity, violence, hate speech, racism, blasphemy. Auto-cleanup job (hourly) deletes videos of profiles inactive 30+ days. Video play icon badge on swipe cards when profile has videos. Video player in profile detail modal. DB table: profile_videos. Endpoints: GET /api/profiles/:profileId/videos, POST /api/profiles/videos/request-upload, POST /api/profiles/videos, DELETE /api/profiles/videos/:videoId. Fully translated IT/EN/ES.
- **Stories Bar**: Horizontal scrollable row of alien-themed story circles at the top of the home/swipe page. Shows profiles that have uploaded videos. Each circle has a cyan-violet-emerald gradient animated ring, profile avatar, and name. Tapping opens a fullscreen story viewer with progress bars, mute toggle, skip by tap/keyboard, auto-advance. Content sourced from profile_videos table via GET /api/stories endpoint (deduplicated by profileId, newest first, max 20). Component: client/src/components/StoriesBar.tsx. Translated IT/EN/ES.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: shadcn/ui
- **PWA**: Service Worker, Web App Manifest

## Project Structure
```
client/
├── public/
│   ├── icons/              # PWA icons (72-512px)
│   ├── images/             # Profile images
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service worker
│   └── favicon.png
├── src/
│   ├── components/
│   │   ├── EmptyState.tsx      # Loading/error/empty state displays
│   │   ├── Header.tsx          # Navigation header with logo
│   │   ├── MatchCard.tsx       # Match display in grid
│   │   ├── MatchModal.tsx      # Celebration modal on new match
│   │   ├── SwipeCard.tsx       # Draggable profile card
│   │   └── VideoBackground.tsx # Animated background with stars
│   ├── pages/
│   │   ├── home.tsx           # Main swipe interface
│   │   ├── matches.tsx        # List of user matches
│   │   ├── profile.tsx        # User profile view
│   │   ├── profile-edit.tsx   # Profile creation/edit form
│   │   ├── rooms.tsx          # Interest-based chat rooms
│   │   ├── challenges.tsx     # Daily photo challenges
│   │   ├── private-rooms.tsx  # Private rooms with access control
│   │   ├── prima-impressione.tsx # Rating system page
│   │   └── vibing.tsx          # Live presence mode page
│   └── App.tsx               # Main app with routing
server/
├── db.ts                     # Database connection
├── routes.ts                 # API endpoints
├── seed.ts                   # Initial data seeding
└── storage.ts               # Data access layer
shared/
└── schema.ts                # Database schema and types
```

## API Endpoints
- `GET /api/profiles` - Get all profiles
- `GET /api/profiles/:id` - Get single profile
- `GET /api/profiles/me` - Get current user's profile (auth required)
- `POST /api/profiles` - Create new profile
- `PUT /api/profiles/:id` - Update profile (validated, protected fields)
- `POST /api/swipe` - Create a swipe (like/dislike)
- `GET /api/matches/:userId` - Get matches for a user
- `GET /api/messages/:matchId` - Get messages for a match (auth required)
- `POST /api/messages` - Send a message (auth required)
- `GET /api/admin/stats` - Get admin statistics (admin required)
- `GET /api/admin/users` - Get all users (admin required)
- `GET /api/admin/profiles` - Get all profiles (admin required)
- `DELETE /api/admin/profiles/:id` - Delete a profile (admin required)
- `PATCH /api/admin/profiles/:id/verify` - Verify/unverify a profile (admin required)
- `GET /api/rooms` - Get all active rooms (auth required)
- `GET /api/challenges` - Get all active challenges (auth required)
- `POST /api/ratings` - Rate a profile (1-10)
- `GET /api/ratings/received` - Get ratings received by current user
- `POST /api/ratings/:id/reply` - Reply to a rating (creates match + opens chat)
- `GET /api/ratings/count` - Get count of unreplied ratings
- `GET /api/private-rooms` - Get all private rooms (auth required)
- `POST /api/vibe/activate` - Activate vibing session with location (auth required)
- `POST /api/vibe/deactivate` - Deactivate vibing session (auth required)
- `GET /api/vibe/status` - Get current vibing status (auth required)
- `GET /api/vibe/nearby` - Get nearby vibing users (auth required)

## Database Schema
- **users**: id, email, firstName, lastName, profileImageUrl, isAdmin, createdAt, updatedAt
- **profiles**: id, userId, name, age, bio, imageUrl, location, interests[], alienType, isBot, isVerified, ratingEnabled, profileLatitude, profileLongitude, maxDistanceKm + 20 new fields (gender, hairColor, eyeColor, bodyType, height, education, languages[], relationshipType, zodiacSign, loveLanguage, etc.)
- **swipes**: id, swiperId, swipedId, liked, createdAt
- **matches**: id, profile1Id, profile2Id, createdAt
- **messages**: id, matchId, senderId, content, read, createdAt
- **rooms**: id, name, description, interest, imageUrl, createdAt, isActive
- **room_members**: id, roomId, profileId, joinedAt
- **private_rooms**: id, ownerId, name, description, imageUrl, createdAt, isActive
- **private_room_requests**: id, roomId, requesterId, status, createdAt, respondedAt
- **daily_challenges**: id, title, description, imageExample, points, isActive
- **challenge_submissions**: id, challengeId, profileId, imageUrl, status, createdAt, reviewedAt
- **virtual_gifts**: id, name, description, cost, animationType, icon, color, sortOrder
- **profile_ratings**: id, raterId, ratedId, rating, ratedReply, matchCreated, createdAt, repliedAt
- **sent_gifts**: id, giftId, senderId, receiverId, message, seen, createdAt
- **vibing_sessions**: id, profileId, latitude, longitude, radiusKm, active, activatedAt, expiresAt

## Color Theme
The app uses a cosmic color palette:
- Primary: Purple/Magenta (hsl 280)
- Secondary: Cyan (hsl 185)
- Accent: Pink (hsl 320)
- Background: Deep space purple-black

## User Preferences
- Italian language for UI text
- Dark mode by default
- Space Grotesk font family

## PWA Installation
The app can be installed on mobile devices:
- On iOS: Open in Safari, tap Share, then "Add to Home Screen"
- On Android: Chrome will show an "Install" prompt, or use menu > "Install App"
