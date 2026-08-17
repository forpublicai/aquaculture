-- Phase B: the filled-in license application, alongside the triage profile.
--
-- `profile` answers "which license does this person need?"; `application` holds
-- the draft of that license's actual form. Null until triage lands on a license
-- type and intake begins, so an old conversation that only ever got a
-- recommendation stays valid.
alter table conversations
  add column if not exists application jsonb;
