-- DropIndex
DROP INDEX "code_versions_projectId_versionNumber_key";

-- AlterTable
ALTER TABLE "project_assets" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "detections" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "code_versions" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "pageId" TEXT;

-- AlterTable
ALTER TABLE "page_boundaries" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "correction_records" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "style_overrides" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "content_overrides" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "geometry_overrides" ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "structure_overrides" ADD COLUMN     "pageId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "activeCodeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pages_activeCodeVersionId_idx" ON "pages"("activeCodeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "pages_projectId_order_key" ON "pages"("projectId", "order");

-- CreateIndex
CREATE INDEX "project_assets_pageId_idx" ON "project_assets"("pageId");

-- CreateIndex
CREATE INDEX "detections_pageId_idx" ON "detections"("pageId");

-- CreateIndex
CREATE INDEX "detections_pageId_status_idx" ON "detections"("pageId", "status");

-- CreateIndex
CREATE INDEX "code_versions_pageId_idx" ON "code_versions"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "code_versions_pageId_versionNumber_key" ON "code_versions"("pageId", "versionNumber");

-- CreateIndex
CREATE INDEX "jobs_pageId_idx" ON "jobs"("pageId");

-- CreateIndex
CREATE INDEX "page_boundaries_pageId_idx" ON "page_boundaries"("pageId");

-- CreateIndex
CREATE INDEX "correction_records_pageId_idx" ON "correction_records"("pageId");

-- CreateIndex
CREATE INDEX "style_overrides_pageId_idx" ON "style_overrides"("pageId");

-- CreateIndex
CREATE INDEX "content_overrides_pageId_idx" ON "content_overrides"("pageId");

-- CreateIndex
CREATE INDEX "geometry_overrides_pageId_idx" ON "geometry_overrides"("pageId");

-- CreateIndex
CREATE INDEX "structure_overrides_pageId_idx" ON "structure_overrides"("pageId");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_versions" ADD CONSTRAINT "code_versions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_boundaries" ADD CONSTRAINT "page_boundaries_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_records" ADD CONSTRAINT "correction_records_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_overrides" ADD CONSTRAINT "style_overrides_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geometry_overrides" ADD CONSTRAINT "geometry_overrides_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_overrides" ADD CONSTRAINT "structure_overrides_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

