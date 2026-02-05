# Vibra - Dating App with Alien Theme

## Overview
Vibra is a Tinder-like dating app with a unique alien/space theme. Users can swipe through profiles of alien beings, match with compatible profiles, and view their matches.

## Features
- **Swipe Cards**: Drag-to-swipe interface similar to Tinder
- **Match System**: When two users like each other, a match is created
- **Alien Theme**: Cosmic color scheme with purple, cyan, and pink glows
- **Video Background Support**: Option to use video backgrounds (currently using animated starfield)
- **Generated Profile Images**: AI-generated alien humanoid portraits

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: shadcn/ui

## Project Structure
```
client/
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
│   │   └── profile.tsx        # User profile view
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
- `POST /api/swipe` - Create a swipe (like/dislike)
- `GET /api/matches/:userId` - Get matches for a user

## Database Schema
- **profiles**: id, name, age, bio, imageUrl, location, interests, alienType
- **swipes**: id, swiperId, swipedId, liked, createdAt
- **matches**: id, profile1Id, profile2Id, createdAt

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
