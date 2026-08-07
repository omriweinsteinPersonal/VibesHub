export interface ResponseMeta {
  requestId: string;
}

export function singleResponse<T>(
  data: T,
  requestId: string,
): { data: T; meta: ResponseMeta } {
  return { data, meta: { requestId } };
}
