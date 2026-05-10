import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { slugify } from "../src/core/normalize.js";
import { prisma } from "../src/db/prisma.js";
import { parseOntologySnapshot } from "../src/services/ontology-snapshot.js";

const fixturePath = resolve(process.cwd(), "../../docs/fixtures/ontology-snapshot.v1.example.json");

function fixtureJson() {
  return readFileSync(fixturePath, "utf8");
}

function snapshotWith(label: string, kind: "beat" | "topic" = "topic") {
  return JSON.stringify({
    schema: "BroadListerOntologySnapshot.v1",
    snapshot_id: `snapshot_${crypto.randomUUID()}`,
    source_system: "ontology-core",
    source_version: `test-${crypto.randomUUID()}`,
    concepts: [{
      concept_id: `entity_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      concept_slug: slugify(label),
      label,
      kind,
      relationship_to_ontology: "exact",
      confidence: "high"
    }]
  });
}

function snapshotFromConcepts(concepts: Array<Record<string, unknown>>, sourceVersion = `test-${crypto.randomUUID()}`) {
  return JSON.stringify({
    schema: "BroadListerOntologySnapshot.v1",
    snapshot_id: `snapshot_${crypto.randomUUID()}`,
    source_system: "ontology-core",
    source_version: sourceVersion,
    exported_at: "2026-05-10T00:00:00.000Z",
    concepts
  });
}

describe("ontology snapshot bridge", () => {
  it("parses the static fixture snapshot", () => {
    const parsed = parseOntologySnapshot(fixtureJson());
    expect(parsed.schema).toBe("BroadListerOntologySnapshot.v1");
    expect(parsed.source_system).toBe("ontology-core");
    expect(parsed.concepts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Crypto policy", kind: "beat" })
    ]));
  });

  it("previews suggested BroadLister matches without mutation", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const label = `Policy Match ${unique}`;
    const tag = await prisma.tag.create({
      data: { name: label, slug: `beat:${slugify(label)}`, kind: "beat" }
    });
    const before = await prisma.reviewItem.count({ where: { kind: "ontology_mapping_candidate" } });
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology/preview",
      payload: { snapshot_json: snapshotWith(label, "beat") }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().rows[0]).toMatchObject({
      suggested_match: { id: tag.id, slug: tag.slug },
      confidence: "high",
      mapping_status: "match_existing"
    });
    expect(await prisma.reviewItem.count({ where: { kind: "ontology_mapping_candidate" } })).toBe(before);
  });

  it("returns field-level preview payload with provenance and external ids", async () => {
    const app = await buildApp();
    const label = `Field Preview ${crypto.randomUUID()}`;
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology/preview",
      payload: { label: "field-preview.json", snapshot_json: snapshotWith(label, "topic") }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const row = response.json().rows[0];
    expect(row).toMatchObject({
      source_system: "ontology-core",
      source_snapshot_label: "field-preview.json",
      name: label,
      source_kind: "topic",
      suggested_tag_kind: "topic",
      mapping_status: "create_new"
    });
    expect(row.external_ids_to_add.ontology_core_id).toContain("entity_");
    expect(row.field_changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "Tag.name", action: "create", proposed: label }),
      expect.objectContaining({ field: "Tag.external_ids_json.ontology_core_id", action: "add_external_id" })
    ]));
    expect(row.provenance_summary).toMatchObject({ source_system: "ontology-core", source_snapshot_label: "field-preview.json" });
  });

  it("commits previewed mappings to review items only", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const label = `Commit Only ${unique}`;
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology",
      payload: { label: "Ontology fixture", snapshot_json: snapshotWith(label) }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.import_batch).toMatchObject({ source_type: "ontology_snapshot", row_count: 1 });
    expect(body.review_items).toHaveLength(1);
    expect(body.review_items[0]).toMatchObject({ kind: "ontology_mapping_candidate", status: "pending" });
    expect(await prisma.tag.count({ where: { name: label } })).toBe(0);
  });

  it("does not create duplicate pending review items for repeated imports of the same snapshot version", async () => {
    const app = await buildApp();
    const label = `Repeat Import ${crypto.randomUUID()}`;
    const sourceVersion = `repeat-${crypto.randomUUID()}`;
    const snapshot = snapshotFromConcepts([{
      concept_id: "entity_repeat_local",
      concept_slug: slugify(label),
      label,
      kind: "topic",
      relationship_to_ontology: "exact"
    }], sourceVersion);
    const first = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshot } });
    const second = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshot } });
    await app.close();

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().review_items[0].id).toBe(first.json().review_items[0].id);
    expect(await prisma.reviewItem.count({ where: { kind: "ontology_mapping_candidate", status: "pending" } })).toBeGreaterThanOrEqual(1);
  });

  it("approves mapping review items by creating or matching local tags and updating external ids", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const label = `Approve Mapping ${unique}`;
    const importResponse = await app.inject({
      method: "POST",
      url: "/imports/ontology",
      payload: { snapshot_json: snapshotWith(label, "topic") }
    });
    const reviewItem = importResponse.json().review_items[0];

    const approveResponse = await app.inject({
      method: "POST",
      url: `/review/${reviewItem.id}/approve`,
      payload: { decided_by: "test" }
    });
    await app.close();

    expect(approveResponse.statusCode).toBe(200);
    const tag = await prisma.tag.findUniqueOrThrow({ where: { slug: `topic:${slugify(label)}` } });
    const externalIds = JSON.parse(tag.external_ids_json ?? "{}");
    expect(externalIds).toMatchObject({
      mapping_state: "approved",
      mapping_source_system: "ontology-core",
      relationship_to_ontology: "exact",
      reviewed_via: "BroadLister review queue"
    });
    expect(String(externalIds.ontology_core_id)).toContain("entity_");
    expect(String(externalIds.approval_timestamp)).toContain("T");
  });

  it("approval is idempotent for already mapped ontology concepts", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const label = `Already Mapped ${unique}`;
    const conceptId = `entity_${unique.replaceAll("-", "").slice(0, 20)}`;
    const tag = await prisma.tag.create({
      data: {
        name: label,
        slug: `topic:${slugify(label)}`,
        kind: "topic",
        external_ids_json: JSON.stringify({ ontology_core_id: conceptId })
      }
    });
    const snapshot = snapshotFromConcepts([{
      concept_id: conceptId,
      concept_slug: slugify(label),
      label,
      kind: "topic",
      relationship_to_ontology: "exact"
    }]);
    const preview = await app.inject({ method: "POST", url: "/imports/ontology/preview", payload: { snapshot_json: snapshot } });
    const imported = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshot } });
    const approved = await app.inject({ method: "POST", url: `/review/${imported.json().review_items[0].id}/approve`, payload: { decided_by: "test" } });
    await app.close();

    expect(preview.json().rows[0].mapping_status).toBe("already_mapped");
    expect(approved.statusCode).toBe(200);
    expect(await prisma.tag.count({ where: { name: label } })).toBe(1);
    expect(approved.json().id).toBe(tag.id);
  });

  it("detects duplicate source IDs in a snapshot and blocks approval", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const snapshot = snapshotFromConcepts([
      { concept_id: "entity_duplicate_local", concept_slug: `dup-a-${unique}`, label: `Duplicate A ${unique}`, kind: "topic" },
      { concept_id: "entity_duplicate_local", concept_slug: `dup-b-${unique}`, label: `Duplicate B ${unique}`, kind: "topic" }
    ]);
    const preview = await app.inject({ method: "POST", url: "/imports/ontology/preview", payload: { snapshot_json: snapshot } });
    const imported = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshot } });
    const approved = await app.inject({ method: "POST", url: `/review/${imported.json().review_items[0].id}/approve`, payload: { decided_by: "test" } });
    await app.close();

    expect(preview.json().rows.map((row: any) => row.mapping_status)).toEqual(["duplicate_in_snapshot", "duplicate_in_snapshot"]);
    expect(approved.statusCode).toBe(400);
    expect(approved.json().error).toContain("duplicate source IDs");
  });

  it("detects external ID conflicts against existing tag mappings", async () => {
    const app = await buildApp();
    const label = `Conflict Mapping ${crypto.randomUUID()}`;
    await prisma.tag.create({
      data: {
        name: label,
        slug: `topic:${slugify(label)}`,
        kind: "topic",
        external_ids_json: JSON.stringify({ ontology_core_id: "entity_existing_conflict" })
      }
    });
    const snapshot = snapshotFromConcepts([{
      concept_id: "entity_incoming_conflict",
      concept_slug: slugify(label),
      label,
      kind: "topic",
      relationship_to_ontology: "exact"
    }]);
    const preview = await app.inject({ method: "POST", url: "/imports/ontology/preview", payload: { snapshot_json: snapshot } });
    const imported = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshot } });
    const approved = await app.inject({ method: "POST", url: `/review/${imported.json().review_items[0].id}/approve`, payload: { decided_by: "test" } });
    await app.close();

    expect(preview.json().rows[0].mapping_status).toBe("conflict");
    expect(preview.json().rows[0].conflict_reasons[0]).toContain("ontology_core_id already stores");
    expect(approved.statusCode).toBe(400);
  });

  it("matches existing tags by normalized label and kind", async () => {
    const app = await buildApp();
    const unique = crypto.randomUUID();
    const label = `Normalized Label ${unique}`;
    const tag = await prisma.tag.create({
      data: { name: label.toLowerCase(), slug: `topic:custom-normalized-${unique}`, kind: "topic" }
    });
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology/preview",
      payload: { snapshot_json: snapshotWith(label.toUpperCase(), "topic") }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().rows[0]).toMatchObject({
      suggested_match: { id: tag.id },
      mapping_status: "match_existing",
      reason: "Matched existing BroadLister tag by normalized name and kind"
    });
  });

  it("allows same label with different kinds but creates distinct suggested tags", async () => {
    const app = await buildApp();
    const label = `Kind Split ${crypto.randomUUID()}`;
    const snapshot = snapshotFromConcepts([
      { concept_id: `entity_topic_${crypto.randomUUID()}`, concept_slug: `${slugify(label)}-topic`, label, kind: "topic" },
      { concept_id: `entity_beat_${crypto.randomUUID()}`, concept_slug: `${slugify(label)}-beat`, label, kind: "beat" }
    ]);
    const response = await app.inject({ method: "POST", url: "/imports/ontology/preview", payload: { snapshot_json: snapshot } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().rows.map((row: any) => row.suggested_tag_slug).sort()).toEqual([`beat:${slugify(label)}`, `topic:${slugify(label)}`].sort());
    expect(response.json().rows.map((row: any) => row.mapping_status)).toEqual(["create_new", "create_new"]);
  });

  it("rejects and defers mapping review items without mutating tags", async () => {
    const app = await buildApp();
    const rejectLabel = `Reject Mapping ${crypto.randomUUID()}`;
    const deferLabel = `Defer Mapping ${crypto.randomUUID()}`;
    const rejectImport = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshotWith(rejectLabel) } });
    const deferImport = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: snapshotWith(deferLabel) } });

    expect((await app.inject({ method: "POST", url: `/review/${rejectImport.json().review_items[0].id}/reject`, payload: { decided_by: "test" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/review/${deferImport.json().review_items[0].id}/defer`, payload: { decided_by: "test" } })).statusCode).toBe(200);
    await app.close();

    expect(await prisma.tag.count({ where: { name: { contains: "Mapping" } } })).toBeGreaterThanOrEqual(0);
    expect(await prisma.tag.count({ where: { name: rejectLabel } })).toBe(0);
    expect(await prisma.tag.count({ where: { name: deferLabel } })).toBe(0);
  });

  it("returns malformed snapshot errors", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology/preview",
      payload: { snapshot_json: "{\"schema\":\"wrong\"}" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("malformed_ontology_snapshot");
  });

  it("returns malformed errors for partial concept records", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/ontology/preview",
      payload: { snapshot_json: snapshotFromConcepts([{ concept_slug: "partial", kind: "topic" }]) }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("malformed_ontology_snapshot");
  });

  it("does not use network calls during preview or import", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    const app = await buildApp();
    const preview = await app.inject({ method: "POST", url: "/imports/ontology/preview", payload: { snapshot_json: fixtureJson() } });
    const commit = await app.inject({ method: "POST", url: "/imports/ontology", payload: { snapshot_json: fixtureJson() } });
    await app.close();
    fetchSpy.mockRestore();

    expect(preview.statusCode).toBe(200);
    expect(commit.statusCode).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
