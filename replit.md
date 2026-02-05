# Vibra - Dating App with Alien Theme

## Overview
Vibra is a Tinder-like dating app with a unique alien/space theme. Users can swipe through profiles of alien beings, match with compatible profiles, chat with matches, and fully customize their profile. Features admin dashboard for moderation and profile verification.

## Features
- **Swipe Cards**: Drag-to-swipe interface similar to Tinder
- **Match System**: When two users like each other, a match is created
- **Real-time Chat**: Chat with your matches in a beautiful chat interface
- **User Profile**: Create and edit your own alien profile
- **Verified Profiles**: Admin can verify profiles (blue checkmark badge)
- **Admin Dashboard**: Statistics, user management, profile moderation
- **Alien Theme**: Cosmic color scheme with purple, cyan, and pink glows
- **Video Background Support**: Animated starfield background
- **Generated Profile Images**: AI-generated alien humanoid portraits
- **PWA Support**: Installable on mobile devices as a standalone app
- **Replit Auth**: Login with Google, Apple, GitHub, Email

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
│   │   └── profile-edit.tsx   # Profile creation/edit form
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

## Database Schema
- **users**: id, email, firstName, lastName, profileImageUrl, isAdmin, createdAt, updatedAt
- **profiles**: id, userId, name, age, bio, imageUrl, location, interests[], alienType, isBot, isVerified
- **swipes**: id, swiperId, swipedId, liked, createdAt
- **matches**: id, profile1Id, profile2Id, createdAt
- **messages**: id, matchId, senderId, content, read, createdAt

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
