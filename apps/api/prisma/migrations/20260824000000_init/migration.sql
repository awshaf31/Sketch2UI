-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'annotated', 'generated', 'archived');

-- CreateEnum
CREATE TYPE "DetectionSource" AS ENUM ('model', 'manual', 'imported');

-- CreateEnum
CREATE TYPE "DetectionStatus" AS ENUM ('active', 'deleted', 'rejected');

-- CreateEnum
CREATE TYPE "CodeVersionSource" AS ENUM ('generated', 'edited');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('detect', 'layout', 'codegen', 'export');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('queued', 'preprocessing', 'component_detection', 'persisting_detections', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DatasetSplit" AS ENUM ('train', 'val', 'test');

-- CreateEnum
CREATE TYPE "PageBoundaryMethod" AS ENUM ('contour', 'none', 'manual');

-- CreateEnum
CREATE TYPE "PageBoundarySource" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('known', 'unknown', 'user_edited');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('created', 'deleted', 'class_changed', 'bbox_changed', 'parent_changed', 'order_changed', 'ignored');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "activeCodeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "bboxX" DOUBLE PRECISION NOT NULL,
    "bboxY" DOUBLE PRECISION NOT NULL,
    "bboxWidth" DOUBLE PRECISION NOT NULL,
    "bboxHeight" DOUBLE PRECISION NOT NULL,
    "status" "DetectionStatus" NOT NULL DEFAULT 'active',
    "source" "DetectionSource" NOT NULL,
    "modelVersionId" TEXT,
    "originalClassName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" "CodeVersionSource" NOT NULL,
    "html" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "javascript" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "stage" "JobStage" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sourceAssetId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryable" BOOLEAN,
    "detectionCount" INTEGER,
    "modelVersionId" TEXT,
    "pageBoundary" JSONB,
    "rejectedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_samples" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageAssetId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "datasetSplit" "DatasetSplit" NOT NULL,
    "boxes" JSONB NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_exports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "codeVersionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_boundaries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "polygon" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "method" "PageBoundaryMethod" NOT NULL,
    "areaFraction" DOUBLE PRECISION NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "overlapThreshold" DOUBLE PRECISION,
    "source" "PageBoundarySource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_boundaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "type" "CorrectionType" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "oldClassName" TEXT,
    "newClassName" TEXT,
    "oldBBoxX" DOUBLE PRECISION,
    "oldBBoxY" DOUBLE PRECISION,
    "oldBBoxWidth" DOUBLE PRECISION,
    "oldBBoxHeight" DOUBLE PRECISION,
    "newBBoxX" DOUBLE PRECISION,
    "newBBoxY" DOUBLE PRECISION,
    "newBBoxWidth" DOUBLE PRECISION,
    "newBBoxHeight" DOUBLE PRECISION,
    "oldParentDetectionId" TEXT,
    "oldParentDetectionIdSet" BOOLEAN NOT NULL DEFAULT false,
    "newParentDetectionId" TEXT,
    "newParentDetectionIdSet" BOOLEAN NOT NULL DEFAULT false,
    "oldDisplayOrder" INTEGER,
    "newDisplayOrder" INTEGER,

    CONSTRAINT "correction_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "style" JSONB NOT NULL,

    CONSTRAINT "style_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "text" TEXT,
    "altText" TEXT,
    "href" TEXT,
    "contentState" "ContentState" NOT NULL DEFAULT 'user_edited',

    CONSTRAINT "content_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geometry_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,

    CONSTRAINT "geometry_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "parentDetectionId" TEXT,
    "parentDetectionIdSet" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER,

    CONSTRAINT "structure_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_activeCodeVersionId_idx" ON "projects"("activeCodeVersionId");

-- CreateIndex
CREATE INDEX "project_assets_projectId_idx" ON "project_assets"("projectId");

-- CreateIndex
CREATE INDEX "detections_projectId_idx" ON "detections"("projectId");

-- CreateIndex
CREATE INDEX "detections_sourceAssetId_idx" ON "detections"("sourceAssetId");

-- CreateIndex
CREATE INDEX "detections_projectId_status_idx" ON "detections"("projectId", "status");

-- CreateIndex
CREATE INDEX "code_versions_projectId_idx" ON "code_versions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "code_versions_projectId_versionNumber_key" ON "code_versions"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "jobs_projectId_idx" ON "jobs"("projectId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "training_samples_projectId_idx" ON "training_samples"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "training_samples_imageAssetId_key" ON "training_samples"("imageAssetId");

-- CreateIndex
CREATE INDEX "project_exports_projectId_idx" ON "project_exports"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_exports_projectId_versionNumber_key" ON "project_exports"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "page_boundaries_projectId_idx" ON "page_boundaries"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "page_boundaries_assetId_key" ON "page_boundaries"("assetId");

-- CreateIndex
CREATE INDEX "correction_records_projectId_idx" ON "correction_records"("projectId");

-- CreateIndex
CREATE INDEX "correction_records_detectionId_idx" ON "correction_records"("detectionId");

-- CreateIndex
CREATE INDEX "correction_records_projectId_timestamp_idx" ON "correction_records"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "style_overrides_projectId_idx" ON "style_overrides"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "style_overrides_detectionId_key" ON "style_overrides"("detectionId");

-- CreateIndex
CREATE INDEX "content_overrides_projectId_idx" ON "content_overrides"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "content_overrides_detectionId_key" ON "content_overrides"("detectionId");

-- CreateIndex
CREATE INDEX "geometry_overrides_projectId_idx" ON "geometry_overrides"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "geometry_overrides_detectionId_key" ON "geometry_overrides"("detectionId");

-- CreateIndex
CREATE INDEX "structure_overrides_projectId_idx" ON "structure_overrides"("projectId");

-- CreateIndex
CREATE INDEX "structure_overrides_parentDetectionId_idx" ON "structure_overrides"("parentDetectionId");

-- CreateIndex
CREATE UNIQUE INDEX "structure_overrides_detectionId_key" ON "structure_overrides"("detectionId");

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_versions" ADD CONSTRAINT "code_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "project_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_samples" ADD CONSTRAINT "training_samples_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_samples" ADD CONSTRAINT "training_samples_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_exports" ADD CONSTRAINT "project_exports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_exports" ADD CONSTRAINT "project_exports_codeVersionId_fkey" FOREIGN KEY ("codeVersionId") REFERENCES "code_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_boundaries" ADD CONSTRAINT "page_boundaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_boundaries" ADD CONSTRAINT "page_boundaries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_records" ADD CONSTRAINT "correction_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_records" ADD CONSTRAINT "correction_records_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_overrides" ADD CONSTRAINT "style_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_overrides" ADD CONSTRAINT "style_overrides_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geometry_overrides" ADD CONSTRAINT "geometry_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geometry_overrides" ADD CONSTRAINT "geometry_overrides_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_overrides" ADD CONSTRAINT "structure_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_overrides" ADD CONSTRAINT "structure_overrides_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_overrides" ADD CONSTRAINT "structure_overrides_parentDetectionId_fkey" FOREIGN KEY ("parentDetectionId") REFERENCES "detections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

