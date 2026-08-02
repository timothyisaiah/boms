export const ROLE_OPTIONS = [
  { value: 'admin_owner', label: 'Admin / Owner' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'production_staff', label: 'Production Staff' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  {
    value: 'sales_or_distribution_staff',
    label: 'Sales or Distribution Staff'
  },
  { value: 'finance_accountant', label: 'Finance / Accountant' },
  { value: 'read_only_management', label: 'Read-only Management' }
]

export const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map(role => [role.value, role.label])
)

export function normalizeRole(role) {
  if (typeof role !== 'string') {
    return null
  }

  const normalizedRole = role
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalizedRole || null
}

export function getRoleLabel(role) {
  const normalizedRole = normalizeRole(role)

  return normalizedRole
    ? (ROLE_LABELS[normalizedRole] ?? 'Assigned Role')
    : 'Role assignment pending'
}

export function hasAllowedRole(role, allowedRoles = []) {
  if (allowedRoles.length === 0) {
    return true
  }

  const normalizedRole = normalizeRole(role)

  if (!normalizedRole) {
    return false
  }

  return allowedRoles.map(normalizeRole).includes(normalizedRole)
}

export function getDefaultRouteForRole(role) {
  switch (normalizeRole(role)) {
    case 'production_staff':
    case 'warehouse_staff':
      return '/operations'

    case 'sales_or_distribution_staff':
      return '/retail'

    case 'finance_accountant':
    case 'read_only_management':
      return '/finance'

    default:
      return '/'
  }
}
