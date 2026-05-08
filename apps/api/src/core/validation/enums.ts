export const mergeStatuses = ["active", "merged_into", "deprecated"] as const;
export const verificationStates = ["unverified", "proposed", "verified", "revoked", "known_invalid"] as const;
export const campaignStates = ["draft", "active", "paused", "closed"] as const;
export const approvalStates = ["draft", "approved", "rejected_for_outreach"] as const;
export const outreachStates = ["none", "planned", "approved", "contacted", "replied", "declined", "hold", "blacklisted_for_client"] as const;
export const relationshipWarmths = ["unknown", "cold", "neutral", "warm", "hot"] as const;
export const confidences = ["low", "medium", "high"] as const;
export const tagKinds = ["beat", "topic", "format", "region", "language", "broad", "specific"] as const;
export const publicPreferenceFlags = [
  "prefers_email_for_pitches",
  "prefers_dm_for_pitches",
  "no_unsolicited_pitches",
  "no_crypto_pitches",
  "no_ai_pitches",
  "prefers_exclusives",
  "prefers_data_driven_angles"
] as const;

