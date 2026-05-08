import { prisma } from "../db/prisma.js";

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export async function getCampaignListForClient(clientId: string, campaignListId: string) {
  const list = await prisma.campaignList.findFirst({
    where: {
      id: campaignListId,
      campaign: { client_id: clientId }
    },
    include: {
      campaign: { include: { client: true } },
      contacts: {
        include: {
          journalist: true,
          outlet: true
        },
        orderBy: { added_at: "asc" }
      }
    }
  });
  if (!list) throw new Error("Campaign list not found for client scope.");
  return list;
}

export async function mediaListCsv(clientId: string, campaignListId: string): Promise<string> {
  const list = await getCampaignListForClient(clientId, campaignListId);
  const rows = [
    ["display_name", "outlet", "target_score", "approval_state", "exclusion_flag", "exclusion_reason", "narrative_fit_summary", "email_safe", "provenance_summary"],
    ...list.contacts.map((contact) => [
      contact.journalist?.display_name ?? "",
      contact.outlet?.name ?? "",
      contact.target_score ?? "",
      contact.approval_state,
      contact.exclusion_flag,
      contact.exclusion_reason ?? "",
      narrativeSummary(contact.narrative_fit_json),
      "false",
      "citation review required"
    ])
  ];
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

export async function markdownBrief(clientId: string, campaignListId: string): Promise<string> {
  const list = await getCampaignListForClient(clientId, campaignListId);
  return [
    `# ${list.campaign.client.display_name} — ${list.campaign.name} / ${list.name}`,
    "",
    "DRAFT — NOT FOR OUTREACH unless approvals and contact readiness are complete.",
    "",
    "## Campaign Constraints",
    "",
    list.campaign.constraints_json ? `\`\`\`json\n${JSON.stringify(JSON.parse(list.campaign.constraints_json), null, 2)}\n\`\`\`` : "_No constraints recorded._",
    "",
    "## Contacts",
    "",
    ...list.contacts.map((contact) => [
      `### ${contact.journalist?.display_name ?? contact.outlet?.name ?? "Unnamed target"}`,
      "",
      `- Outlet: ${contact.outlet?.name ?? "—"}`,
      `- Target score: ${contact.target_score ?? "—"}`,
      `- Approval state: ${contact.approval_state}`,
      `- Excluded: ${contact.exclusion_flag ? `yes — ${contact.exclusion_reason ?? "no reason recorded"}` : "no"}`,
      `- Narrative fit: ${narrativeSummary(contact.narrative_fit_json)}`,
      ""
    ].join("\n"))
  ].join("\n");
}

export async function sourceAuditMarkdown(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found.");
  const citations = await prisma.citation.findMany({ orderBy: { observed_at: "desc" }, take: 200 });
  return [
    `# ${client.display_name} Source Audit`,
    "",
    "Sources used by BroadLister global facts and campaign records. Overlay strategy is not exported here.",
    "",
    "| observed_at | source_type | source_url | notes |",
    "| --- | --- | --- | --- |",
    ...citations.map((citation) => `| ${citation.observed_at.toISOString()} | ${citation.source_type} | ${citation.source_url ?? ""} | ${(citation.notes ?? "").replace(/\|/g, "\\|")} |`)
  ].join("\n");
}

export async function approvalLogMarkdown(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found.");
  const approvals = await prisma.clientApproval.findMany({ where: { client_id: clientId }, orderBy: { created_at: "desc" } });
  return [
    `# ${client.display_name} Approval and Fact-Check Log`,
    "",
    "| state | subject_type | subject_id | decided_at | note |",
    "| --- | --- | --- | --- | --- |",
    ...approvals.map((approval) => `| ${approval.state} | ${approval.subject_type} | ${approval.subject_id} | ${approval.decided_at?.toISOString() ?? ""} | ${(approval.note ?? "").replace(/\|/g, "\\|")} |`)
  ].join("\n");
}

function narrativeSummary(value: string | null): string {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as { narrative_angle?: string; confidence?: string };
    return [parsed.narrative_angle, parsed.confidence ? `confidence: ${parsed.confidence}` : ""].filter(Boolean).join(" — ");
  } catch {
    return "";
  }
}

