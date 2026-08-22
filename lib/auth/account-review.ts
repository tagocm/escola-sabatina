type AuthenticatedUser = {
  id?: string | null;
};

// This is intentionally kept in one server-side policy seam so the temporary
// review hold can be removed without touching the login UI or the account data.
const ACCOUNTS_UNDER_REVIEW = new Set<string>();

export function isAccountUnderReview(user: AuthenticatedUser | null | undefined) {
  return Boolean(user?.id && ACCOUNTS_UNDER_REVIEW.has(user.id));
}
