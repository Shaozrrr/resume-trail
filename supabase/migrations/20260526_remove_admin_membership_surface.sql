-- Remove admin-style membership behavior from cloud accounts.
-- Historical admin accounts are normalized to monthly members.

update public.rt_accounts
set membership_tier = 'monthly',
    is_lifetime = false,
    membership_expires_at = coalesce(membership_expires_at, now() + interval '30 days'),
    is_admin = false,
    status = case when status = 'paused' then status else 'active' end,
    updated_at = now()
where coalesce(is_admin, false) = true
   or membership_tier = 'admin';
