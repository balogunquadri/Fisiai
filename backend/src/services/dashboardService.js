const buildDashboardSummary = ({ merchantCount = 0, inventoryCount = 0, contactCount = 0, recentActivity = [] }) => ({
  merchantCount,
  inventoryCount,
  contactCount,
  totalStock: inventoryCount,
  harvestedContacts: contactCount,
  webhookStatus: 'operational',
  recentActivity: recentActivity.slice(0, 6).map((entry) => ({
    id: entry.id || entry._id || `${entry.entityType}-${entry.createdAt}`,
    name: entry.userName || 'System',
    type: entry.entityType?.toLowerCase() || 'activity',
    description: entry.details?.content || entry.action || 'No description available',
    timestamp: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Recently updated',
    tag: entry.action || 'ACTIVITY',
    tagColor: entry.status === 'Failure' ? 'orange' : 'green',
    avatar: (entry.userName || 'S').charAt(0).toUpperCase(),
  })),
});

module.exports = {
  buildDashboardSummary,
};
