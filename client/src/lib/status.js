/** Order status → badge class + label (mirrors legacy getStatusBadgeClass/formatStatus). */
export const ORDER_STATUS = {
  RECEIVED: { badge: 'badge-neutral', label: 'Received' },
  PROCESSING: { badge: 'badge-accent', label: 'Processing' },
  PRINTED: { badge: 'badge-success', label: 'Printed' },
  DELIVERED: { badge: 'badge-success', label: 'Delivered' },
  CANCELLED: { badge: 'badge-danger', label: 'Cancelled' },
};

export function statusBadge(status) {
  return ORDER_STATUS[status] || { badge: 'badge-neutral', label: status || 'Unknown' };
}

/** Ordered tracking steps for the stepper. */
export const TRACK_STEPS = [
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PROCESSING', label: 'Printing' },
  { key: 'PRINTED', label: 'Printed' },
  { key: 'DELIVERED', label: 'Delivered' },
];
