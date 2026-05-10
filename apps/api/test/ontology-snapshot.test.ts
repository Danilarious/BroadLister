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
      confidence: "high"
    });
    expect(await prisma.reviewItem.count({ where: { kind: "ontology_mapping_candidate" } })).toBe(before);
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
      relationship_to_ontology: "exact"
    });
    expect(String(externalIds.ontology_core_id)).toContain("entity_");
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
