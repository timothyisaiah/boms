# Variant Permission Error - Diagnostic Guide

## Issue Summary

You're receiving a "you don't have permission" error when trying to add variants, even though your role is `admin_owner`.

## What I Found

### ✅ Working Components

- Database functions for variant management are correctly implemented
- All tests pass (7/7)
- Role-based access control logic is correct
- Frontend permission checks for `admin_owner` and `operations_manager` roles are in place
- Materials management is fully implemented and integrated

### 🔧 Fixed Issue

- **Test Bug**: The variant test was passing the full body as the hash parameter instead of the SHA256 hash. This has been corrected to match production code.

## Troubleshooting Steps

### Step 1: Check Your Session in Browser Console

1. Open the browser's Developer Tools (F12)
2. Go to Application → Cookies
3. Look for `boms_session` cookie
4. If it's missing, you're not logged in correctly

### Step 2: Verify Your Role in the Database

When you're logged in, the role should be `admin_owner`. To check:

1. Open Developer Tools Console
2. Try a variant save and look at the Network tab
3. Check the response from `/api/write?action=variants`
4. Look for error details

### Step 3: Check Error Response

The actual error response should show:

- If error is `"Your role cannot manage variants."` → Database function is checking your role
- If error is `"Your role cannot perform this action."` → API layer permission check failed
- If another error → Validation error on the request

## Most Common Causes

### Cause 1: Session Not Persisted

**Symptom**: You can view the page but can't save anything
**Solution**:

- Clear cookies and log in again
- Check that browser allows 3rd-party cookies
- Ensure Secure/SameSite flags are set correctly

### Cause 2: Role Mismatch in Database

**Symptom**: You see the "Add variant" button but get permission error on save
**Solution**:

- Your user record in Neon might have a different role than expected
- Admin should verify your role in `public.users` table
- Roles must be exact: `'admin_owner'` (with quotes if checking directly)

### Cause 3: Invalid Session Token

**Symptom**: Permission error immediately after logging in
**Solution**:

- Log out and log in again
- Browser session might have expired (7 days max)
- Check that idempotency keys aren't being blocked

## Code Locations for Reference

- **Permission Check (API Layer)**: [server/auth.ts](server/auth.ts) → `requireRole()` function
- **Permission Check (Database)**: [neon/migrations/202609120012_variant_management.sql](neon/migrations/202609120012_variant_management.sql) → `execute_variant_save()` function
- **Frontend Permission Check**: [src/components/VariantManager.vue](src/components/VariantManager.vue) → `canManage` computed property
- **Write Handler**: [api/write.ts](api/write.ts) → sets `boms.actor_id` and calls the database function

## How Variant Creation Works

1. Frontend checks if user's role is `admin_owner` or `operations_manager`
2. If yes, shows "Add variant" button
3. On submit, sends POST to `/api/write?action=variants` with Idempotency-Key header
4. API layer checks if session exists and user has variant write permission
5. Sets `boms.actor_id` in database session context
6. Calls `execute_variant_save()` function which:
   - Gets the actor's role from users table using the actor_id
   - Validates the role is admin_owner or operations_manager
   - Saves the variant and creates audit trails

## Next Steps

If the issue persists:

1. Check browser console for exact error message
2. Share the Network tab response from `/api/write?action=variants`
3. Verify your user record has `app_role='admin_owner'` in the database
4. Clear browser storage and try again: `sessionStorage.clear(); localStorage.clear()`

## Materials Management Status

✅ **Complete and fully implemented**

- Available at: Operations → Add material / Manage materials
- Roles: admin_owner, operations_manager, warehouse_staff
- Features: Search, type/status filters, stock thresholds, active/inactive toggle
