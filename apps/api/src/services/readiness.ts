import { prisma } from "../db/prisma.js";

export async function contactMethodIsEmailSafe(contactMethodId: string): Promise<boolean> {
  const contact = await prisma.contactMethod.findUnique({ where: { id: contactMethodId } });
  return Boolean(contact?.verification_state === "verified" && contact.lawful_to_store && contact.verified_via_citation_id);
}

export async function campaignListApprovalState(campaignListId: string): Promise<"approved" | "missing"> {
  const list = await prisma.campaignList.findUnique({
    where: { id: campaignListId },
    include: { campaign: true }
  });
  if (!list) return "missing";
  const approval = await prisma.clientApproval.findFirst({
    where: {
      client_id: list.campaign.client_id,
      subject_type: "campaign_list",
      subject_id: campaignListId,
      state: "approved"
    }
  });
  return approval ? "approved" : "missing";
}

