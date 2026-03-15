CREATE TABLE messages (
  id uuid default gen_random_uuid() primary key,
  "messageId" text unique,
  "userId" text,
  "text" text,
  "emoji" text,
  "fileUrl" text,
  "createdAt" bigint
);

-- Delete messages older than 24 hours (optional if the Node server does the hourly cleanup, but good to have)
-- This allows the server code to delete properly.
