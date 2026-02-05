# Hono Telegram Via Helper

This repository now contains only a Hono service for Telegram "via-telegram" flow:
- Normalize Telegram bot token input
- Call Telegram `getUpdates`
- Find `chat_id` from a keyword in update messages
- Provide a simple web UI at `/via-telegram`

## Run locally

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000/via-telegram`

## Build and run

- Build: `npm run build`
- Start: `npm run start`

## API routes

- `GET /health`
- `POST /api/telegram/get-updates`
  - body: `{ "token": "...", "limit": 100, "timeout": 0, "offset": 0 }`
- `POST /api/telegram/find-chat-id`
  - body: `{ "keyword": "...", "updates": [...], "token": "..." }`
  - If `updates` is missing, server fetches updates using `token`.
