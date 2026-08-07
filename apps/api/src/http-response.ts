export interface ResponseMeta {
  requestId: string;
}

export function singleResponse<T>(
  data: T,
  requestId: string,
): { data: T; meta: ResponseMeta } {
  return { data, meta: { requestId } };
}

export function collectionResponse<T>(
  data: T[],
  nextCursor: string | null,
  requestId: string,
): {
  data: T[];
  meta: ResponseMeta;
  page: { hasMore: boolean; nextCursor: string | null };
} {
  return {
    data,
    meta: { requestId },
    page: { hasMore: nextCursor !== null, nextCursor },
  };
}
