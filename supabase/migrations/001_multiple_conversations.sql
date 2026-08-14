-- Multiple conversations per browser.
--
-- Before: one row per browser (the cookie value WAS the conversation id), so a
-- user had exactly one chat, forever. Now the cookie identifies the browser and
-- each row is one conversation belonging to it.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/001_multiple_conversations.sql
-- or paste into the Supabase dashboard SQL editor.

alter table conversations add column if not exists user_id text;
alter table conversations add column if not exists title text;

-- The chat list query: "this browser's conversations, most recent first."
create index if not exists conversations_user_updated_idx
  on conversations (user_id, updated_at desc);

-- Pre-existing rows have no user_id and so belong to nobody. They were the
-- single-conversation-per-browser rows from before this change; leaving them
-- unclaimed is intentional — there is no way to tell which browser they came
-- from, and inventing an owner would show one user another user's chat.
