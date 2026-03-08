# Vibra - Dating App with Alien Theme

## Overview
Vibra is a Tinder-like dating app with an alien/space theme. It allows users to swipe through alien profiles, match, chat, and customize their profiles. Key features include an admin dashboard for moderation, AI-generated bot profiles with personality-aware chat, PWA support, and a unique referral system. The project aims to offer a novel dating experience with engaging interactive features like daily challenges, virtual gifts, interest-based chat rooms, and real-time activity feeds, all while maintaining a consistent cosmic aesthetic. The business vision is to capture a niche in the dating app market by providing a fun, immersive, and secure platform with advanced social interaction functionalities.

## User Preferences
- Italian language for UI text
- Dark mode by default
- Space Grotesk font family

## System Architecture
Vibra employs a modern web application architecture:
-   **Frontend**: Built with React, TypeScript, and Tailwind CSS for a responsive and dynamic user interface. Framer Motion is used for animations, providing a smooth, engaging user experience. UI components are leveraged from `shadcn/ui`.
-   **Backend**: Powered by Express.js and Node.js, providing a robust API layer for all client-server communication.
-   **Database**: PostgreSQL is used for data persistence, managed with Drizzle ORM for type-safe database interactions.
-   **Authentication**: Custom email/password authentication is implemented with bcrypt for password hashing and secure session management.
-   **Theming**: A cosmic color scheme (purple, cyan, pink) with a deep space purple-black background defines the app's aesthetic. Video backgrounds featuring animated starfields enhance the immersive alien theme.
-   **Core Features**:
    -   **Swipe and Match System**: Tinder-like swipe cards and a match-making algorithm.
    -   **Real-time Chat**: Utilizes Socket.io for instant messaging, including typing indicators, read receipts, emoji reactions, and private replies, similar to WhatsApp.
    -   **Profile Management**: Extensive customization options with 20+ fields, persistent photo storage in Replit Object Storage, and support for profile videos with AI content moderation.
    -   **Bot Integration**: AI-generated bot profiles communicate using OpenAI's API, providing personality-aware responses.
    -   **PWA Support**: The application is installable on mobile devices, offering an app-like experience.
    -   **Engagement Systems**:
        -   **Interest Rooms & Private Rooms**: Public and exclusive chat spaces.
        -   **Daily Challenges**: Photo submission challenges with point rewards.
        -   **Virtual Gifts**: Points can be used to send animated gifts.
        -   **Prima Impressione**: A rating system allowing users to get feedback on their profiles.
        -   **Sto Vibing Ora**: A live presence mode showing nearby active users.
        -   **Activity Feed & Vibration Activity**: Real-time notifications and personalized engagement dashboards to boost user retention.
        -   **Cosmic Signals**: A public social feed where users post short messages (text/photo/video/audio) for everyone to see. Supports ❤️ likes and 💬 comments. Accessible at `/signals`. Profile detail sheet shown on user tap.
        -   **Quick Reactions**: Alien-themed emoji reactions (🔥 Fuoco, 🛸 Vibra, ✨ Wow, 😍 Crush) shown on each swipe card inside the card overlay. Stored in `profile_reactions` table; supports toggle/change via POST /api/reactions; counts shown per emoji.
        -   **Stories Bar**: A horizontal feed of short profile videos.
-   **Admin Features**: A comprehensive dashboard for user management, profile moderation, verification, and analytics, with real-time stats excluding bot data. Admin can manually manage highlighted profiles and trigger database backups.
-   **Geolocation**: Haversine formula is used for accurate distance calculations between users, leveraging a database of Italian city coordinates.
-   **Database Schema**: Key tables include `users`, `profiles`, `swipes`, `matches`, `messages`, `rooms`, `private_rooms`, `daily_challenges`, `challenge_submissions`, `profile_ratings`, `sent_gifts`, `vibing_sessions`, `push_subscriptions`, `vibrapp_messages`, and `profile_videos`.
-   **Security**: Regular automatic daily database backups to Object Storage ensure data integrity and disaster recovery.

## External Dependencies
-   **Replit Object Storage**: For persistent storage of all user-uploaded photos, videos, and daily database backups.
-   **OpenAI API (gpt-4o-mini)**: Powers AI bot chat responses and performs content moderation on uploaded profile videos (analyzing first frame thumbnails).
-   **Gmail Integration (privacyvibra@gmail.com)**: Used for sending welcome emails and bulk emails via Replit Google Mail connector with OAuth.
-   **Web Push API (web-push npm package)**: For targeted push notifications to opted-in users regarding match messages and Vibrapp replies.
-   **Socket.io**: Enables real-time communication for the Vibrapp global chat.