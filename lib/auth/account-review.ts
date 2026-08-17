type AuthenticatedUser = {
  id?: string | null;
};

// This is intentionally kept in one server-side policy seam so the temporary
// review hold can be removed without touching the login UI or the account data.
const ACCOUNTS_UNDER_REVIEW = new Set([
  "51cc1e11-a35d-4bf3-aa62-78974accb2cb",
]);

export function isAccountUnderReview(user: AuthenticatedUser | null | undefined) {
  return Boolean(user?.id && ACCOUNTS_UNDER_REVIEW.has(user.id));
}
