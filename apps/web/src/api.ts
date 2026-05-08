import type { ApiRecord, ImportBatch, ResourceName, ReviewItem } from "./types.js";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listResource(resource: ResourceName, query = ""): Promise<ApiRecord[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return request<ApiRecord[]>(`/${resource}?${params.toString()}`);
}

export function listReviews(status = "pending", importBatchId?: string): Promise<ReviewItem[]> {
  const params = new URLSearchParams({ status });
  if (importBatchId) params.set("source_import_batch_id", importBatchId);
  return request<ReviewItem[]>(`/review?${params.toString()}`);
}

export function approveReview(id: string): Promise<ApiRecord> {
  return request<ApiRecord>(`/review/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ decided_by: "operator" })
  });
}

export function rejectReview(id: string, decision_note?: string): Promise<ReviewItem> {
  return request<ReviewItem>(`/review/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ decided_by: "operator", decision_note })
  });
}

export function importCsv(payload: { label: string; csv: string; mapping: Record<string, string> }): Promise<ImportBatch> {
  return request<ImportBatch>("/imports/csv", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function ingestUrl(payload: { url: string; html: string }): Promise<{ review_items: ReviewItem[] }> {
  return request<{ review_items: ReviewItem[] }>("/imports/url", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createResource(resource: ResourceName | "clients", payload: Record<string, unknown>): Promise<ApiRecord> {
  return request<ApiRecord>(`/${resource}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

