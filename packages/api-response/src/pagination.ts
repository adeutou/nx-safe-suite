import type {
  CursorPaginationMeta,
  CursorPaginationOptions,
  OffsetPaginationMeta,
  OffsetPaginationOptions,
  PaginationMeta,
  PaginationOptions,
} from "./types";

export function buildOffsetMeta(opts: OffsetPaginationOptions): OffsetPaginationMeta {
  const totalPages = opts.limit > 0 ? Math.ceil(opts.total / opts.limit) : 1;
  return {
    kind: "offset",
    page: opts.page,
    limit: opts.limit,
    total: opts.total,
    totalPages,
    hasNextPage: opts.page < totalPages,
    hasPrevPage: opts.page > 1,
  };
}

export function buildCursorMeta(opts: CursorPaginationOptions): CursorPaginationMeta {
  return {
    kind: "cursor",
    cursor: opts.cursor,
    hasNextPage: opts.hasNextPage,
    hasPrevPage: opts.hasPrevPage ?? false,
    ...(opts.total !== undefined ? { total: opts.total } : {}),
  };
}

export function buildPaginationMeta(opts: PaginationOptions): PaginationMeta {
  if (opts.kind === "offset") return buildOffsetMeta(opts);
  return buildCursorMeta(opts);
}
