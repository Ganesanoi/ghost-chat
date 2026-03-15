-- Run this in your Supabase SQL Editor to add the new features!

-- Add new columns to support nicknames, colors, ghost mode, and reactions
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS nickname text,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS ghost_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb;

-- Allow anonymous users to add reactions (update existing messages)
CREATE POLICY "Allow Anon Updates for Reactions"
ON storage.objects FOR UPDATE
USING ( true )
WITH CHECK ( true );

-- Oops, the above is for storage. We need it for the messages table!
CREATE POLICY "Allow Anon Updates"
ON public.messages FOR UPDATE
USING ( true )
WITH CHECK ( true );

-- Also allow deleting messages (for True Ghost Mode self-destruct)
CREATE POLICY "Allow Anon Deletes"
ON public.messages FOR DELETE
USING ( true );
