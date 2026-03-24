export function buildPaginatedResponse<
  T extends { id: string; createdAt: Date },
>(items: T[], limit: number) {
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: lastItem
      ? `${lastItem.createdAt.toISOString()}_${lastItem.id}`
      : null,
    hasMore: items.length === limit,
  };
}