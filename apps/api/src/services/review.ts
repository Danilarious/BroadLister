import { prisma } from "../db/prisma.js";

type ReviewProposal =
  | { action: "create"; model: "journalist" | "outlet" | "article" | "tag" | "contactMethod"; data: Record<string, unknown> }
  | { action: "update"; model: "journalist" | "outlet" | "article" | "tag" | "contactMethod"; id: string; data: Record<string, unknown> }
  | { action: "create_after_outlet_review"; model: "article"; data: Record<string, unknown>; blocked_reason: string };

export async function applyReviewItem(id: string, decidedBy = "operator") {
  const item = await prisma.reviewItem.findUnique({ where: { id } });
  if (!item) throw new Error("Review item not found.");
  if (item.status !== "pending") throw new Error("Review item is not pending.");

  const proposal = JSON.parse(item.proposal_payload_json) as ReviewProposal;
  if (proposal.action === "create_after_outlet_review") {
    throw new Error(proposal.blocked_reason);
  }
  const model = (prisma as any)[proposal.model];
  if (!model) throw new Error(`Unsupported review model: ${proposal.model}`);

  const result = proposal.action === "create"
    ? await model.create({ data: proposal.data })
    : await model.update({ where: { id: proposal.id }, data: proposal.data });

  await prisma.reviewItem.update({
    where: { id },
    data: {
      status: "approved",
      decided_at: new Date(),
      decided_by: decidedBy
    }
  });

  return result;
}
