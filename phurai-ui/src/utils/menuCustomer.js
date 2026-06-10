/**
 * True when the visitor may use customer menu cart actions (add to cart).
 * Staff/admin roles are excluded when roleName is present.
 */
export function isMenuCustomer(isAuthenticated, user) {
  if (!isAuthenticated || !user) return false;

  const role = String(user.roleName ?? user.role_name ?? '').trim().toLowerCase();
  if (!role) return true;

  const blocked = new Set([
    'admin',
    'manager',
    'restaurant staff',
    'kitchen staff',
  ]);

  return !blocked.has(role);
}
