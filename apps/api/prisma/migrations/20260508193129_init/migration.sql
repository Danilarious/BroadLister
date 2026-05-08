-- CreateTable
CREATE TABLE "Journalist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "display_name_norm" TEXT NOT NULL,
    "name_variants_json" TEXT NOT NULL DEFAULT '[]',
    "primary_affiliation_id" TEXT,
    "bio_short" TEXT,
    "home_country" TEXT,
    "home_region" TEXT,
    "languages_json" TEXT,
    "external_handles_json" TEXT,
    "global_status_flags_json" TEXT,
    "merge_status" TEXT NOT NULL DEFAULT 'active',
    "merged_into_id" TEXT,
    "freshness_signal" DATETIME,
    "confidence_score" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Journalist_primary_affiliation_id_fkey" FOREIGN KEY ("primary_affiliation_id") REFERENCES "Affiliation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "name_norm" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_outlet_id" TEXT,
    "outlet_type" TEXT NOT NULL,
    "home_url" TEXT,
    "home_url_host" TEXT,
    "rss_feeds_json" TEXT,
    "region" TEXT,
    "country" TEXT,
    "languages_json" TEXT,
    "notes_public" TEXT,
    "merge_status" TEXT NOT NULL DEFAULT 'active',
    "merged_into_id" TEXT,
    "freshness_signal" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Outlet_parent_outlet_id_fkey" FOREIGN KEY ("parent_outlet_id") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Affiliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalist_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Affiliation_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Affiliation_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "url_canonical" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published_at" DATETIME,
    "outlet_id" TEXT NOT NULL,
    "byline_text" TEXT,
    "language" TEXT,
    "excerpt" TEXT,
    "fetched_at" DATETIME,
    "fetch_etag" TEXT,
    "fetch_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Article_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Byline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "journalist_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Byline_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Byline_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "external_ids_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JournalistTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalist_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "citation_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalistTag_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalistTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outlet_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "citation_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutletTag_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArticleTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleTag_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArticleTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject_type" TEXT NOT NULL,
    "journalist_id" TEXT,
    "outlet_id" TEXT,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_norm" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "verification_state" TEXT NOT NULL DEFAULT 'unverified',
    "lawful_to_store" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" DATETIME,
    "verified_via_citation_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ContactMethod_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContactMethod_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "source_local_path" TEXT,
    "observed_at" DATETIME NOT NULL,
    "captured_by" TEXT,
    "notes" TEXT,
    "payload_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProvenanceLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citation_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_field" TEXT,
    "assertion_kind" TEXT NOT NULL DEFAULT 'supports',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProvenanceLink_citation_id_fkey" FOREIGN KEY ("citation_id") REFERENCES "Citation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proposal_payload_json" TEXT NOT NULL,
    "current_payload_json" TEXT,
    "source_citation_id" TEXT,
    "source_import_batch_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" DATETIME,
    "decided_by" TEXT,
    "decision_note" TEXT
);

-- CreateTable
CREATE TABLE "MergeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "merged_from_id" TEXT NOT NULL,
    "merged_into_id" TEXT NOT NULL,
    "merge_strategy" TEXT NOT NULL,
    "field_resolutions_json" TEXT NOT NULL,
    "reversible_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'uploaded',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "ImportBatchRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "raw_json" TEXT NOT NULL,
    "mapped_json" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "decided_at" DATETIME,
    "decision_note" TEXT,
    CONSTRAINT "ImportBatchRow_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "objective_short" TEXT,
    "embargo_until" DATETIME,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "start_date" DATETIME,
    "target_end_date" DATETIME,
    "lead_operator" TEXT,
    "constraints_json" TEXT,
    "constraints_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Campaign_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "CampaignList_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_list_id" TEXT NOT NULL,
    "journalist_id" TEXT,
    "outlet_id" TEXT,
    "target_score" INTEGER,
    "target_rationale" TEXT,
    "pitch_angle" TEXT,
    "suitability_note" TEXT,
    "exclusion_flag" BOOLEAN NOT NULL DEFAULT false,
    "exclusion_reason" TEXT,
    "embargo_note" TEXT,
    "approval_state" TEXT NOT NULL DEFAULT 'draft',
    "narrative_fit_json" TEXT,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT,
    CONSTRAINT "CampaignContact_campaign_list_id_fkey" FOREIGN KEY ("campaign_list_id") REFERENCES "CampaignList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignContact_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignContact_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "journalist_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'none',
    "relationship_warmth" TEXT NOT NULL DEFAULT 'unknown',
    "last_event_at" DATETIME,
    "notes_private" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "OutreachStatus_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachStatus_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "journalist_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "kind" TEXT NOT NULL,
    "channel" TEXT,
    "summary_private" TEXT,
    "external_ref" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "OutreachEvent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachEvent_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachEvent_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "journalist_id" TEXT,
    "outlet_id" TEXT,
    "campaign_id" TEXT,
    "body_md" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "ClientNote_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientNote_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "Journalist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClientNote_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientTag_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" TEXT,
    "decided_at" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ClientApproval_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Journalist_display_name_norm_idx" ON "Journalist"("display_name_norm");

-- CreateIndex
CREATE INDEX "Journalist_merge_status_idx" ON "Journalist"("merge_status");

-- CreateIndex
CREATE INDEX "Journalist_freshness_signal_idx" ON "Journalist"("freshness_signal");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_slug_key" ON "Outlet"("slug");

-- CreateIndex
CREATE INDEX "Outlet_name_norm_idx" ON "Outlet"("name_norm");

-- CreateIndex
CREATE INDEX "Outlet_home_url_host_idx" ON "Outlet"("home_url_host");

-- CreateIndex
CREATE INDEX "Outlet_merge_status_idx" ON "Outlet"("merge_status");

-- CreateIndex
CREATE INDEX "Affiliation_journalist_id_is_current_idx" ON "Affiliation"("journalist_id", "is_current");

-- CreateIndex
CREATE INDEX "Affiliation_outlet_id_is_current_idx" ON "Affiliation"("outlet_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_canonical_key" ON "Article"("url_canonical");

-- CreateIndex
CREATE INDEX "Article_outlet_id_published_at_idx" ON "Article"("outlet_id", "published_at");

-- CreateIndex
CREATE INDEX "Article_published_at_idx" ON "Article"("published_at");

-- CreateIndex
CREATE INDEX "Byline_journalist_id_idx" ON "Byline"("journalist_id");

-- CreateIndex
CREATE UNIQUE INDEX "Byline_article_id_journalist_id_key" ON "Byline"("article_id", "journalist_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_kind_idx" ON "Tag"("kind");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "JournalistTag_tag_id_idx" ON "JournalistTag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalistTag_journalist_id_tag_id_key" ON "JournalistTag"("journalist_id", "tag_id");

-- CreateIndex
CREATE INDEX "OutletTag_tag_id_idx" ON "OutletTag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "OutletTag_outlet_id_tag_id_key" ON "OutletTag"("outlet_id", "tag_id");

-- CreateIndex
CREATE INDEX "ArticleTag_tag_id_idx" ON "ArticleTag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTag_article_id_tag_id_key" ON "ArticleTag"("article_id", "tag_id");

-- CreateIndex
CREATE INDEX "ContactMethod_value_hash_idx" ON "ContactMethod"("value_hash");

-- CreateIndex
CREATE INDEX "ContactMethod_journalist_id_kind_is_primary_idx" ON "ContactMethod"("journalist_id", "kind", "is_primary");

-- CreateIndex
CREATE INDEX "ContactMethod_outlet_id_kind_is_primary_idx" ON "ContactMethod"("outlet_id", "kind", "is_primary");

-- CreateIndex
CREATE INDEX "Citation_source_type_idx" ON "Citation"("source_type");

-- CreateIndex
CREATE INDEX "Citation_observed_at_idx" ON "Citation"("observed_at");

-- CreateIndex
CREATE INDEX "ProvenanceLink_target_type_target_id_idx" ON "ProvenanceLink"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "ProvenanceLink_citation_id_idx" ON "ProvenanceLink"("citation_id");

-- CreateIndex
CREATE INDEX "ReviewItem_status_kind_idx" ON "ReviewItem"("status", "kind");

-- CreateIndex
CREATE INDEX "ReviewItem_source_import_batch_id_idx" ON "ReviewItem"("source_import_batch_id");

-- CreateIndex
CREATE INDEX "MergeEvent_entity_type_merged_into_id_idx" ON "MergeEvent"("entity_type", "merged_into_id");

-- CreateIndex
CREATE INDEX "MergeEvent_entity_type_merged_from_id_idx" ON "MergeEvent"("entity_type", "merged_from_id");

-- CreateIndex
CREATE INDEX "ImportBatch_state_idx" ON "ImportBatch"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatchRow_batch_id_row_index_key" ON "ImportBatchRow"("batch_id", "row_index");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE INDEX "Campaign_client_id_state_idx" ON "Campaign"("client_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_client_id_slug_key" ON "Campaign"("client_id", "slug");

-- CreateIndex
CREATE INDEX "CampaignList_campaign_id_idx" ON "CampaignList"("campaign_id");

-- CreateIndex
CREATE INDEX "CampaignContact_campaign_list_id_idx" ON "CampaignContact"("campaign_list_id");

-- CreateIndex
CREATE INDEX "CampaignContact_journalist_id_idx" ON "CampaignContact"("journalist_id");

-- CreateIndex
CREATE INDEX "CampaignContact_outlet_id_idx" ON "CampaignContact"("outlet_id");

-- CreateIndex
CREATE INDEX "OutreachStatus_client_id_state_idx" ON "OutreachStatus"("client_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachStatus_client_id_journalist_id_key" ON "OutreachStatus"("client_id", "journalist_id");

-- CreateIndex
CREATE INDEX "OutreachEvent_client_id_journalist_id_created_at_idx" ON "OutreachEvent"("client_id", "journalist_id", "created_at");

-- CreateIndex
CREATE INDEX "OutreachEvent_campaign_id_idx" ON "OutreachEvent"("campaign_id");

-- CreateIndex
CREATE INDEX "ClientNote_client_id_idx" ON "ClientNote"("client_id");

-- CreateIndex
CREATE INDEX "ClientNote_client_id_journalist_id_idx" ON "ClientNote"("client_id", "journalist_id");

-- CreateIndex
CREATE INDEX "ClientNote_client_id_outlet_id_idx" ON "ClientNote"("client_id", "outlet_id");

-- CreateIndex
CREATE INDEX "ClientNote_client_id_campaign_id_idx" ON "ClientNote"("client_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTag_client_id_name_key" ON "ClientTag"("client_id", "name");

-- CreateIndex
CREATE INDEX "ClientApproval_client_id_subject_type_subject_id_idx" ON "ClientApproval"("client_id", "subject_type", "subject_id");
