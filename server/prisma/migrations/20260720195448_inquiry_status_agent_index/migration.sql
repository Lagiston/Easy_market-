-- CreateIndex
CREATE INDEX "inquiry_status_assignedAgentId_idx" ON "inquiry"("status", "assignedAgentId");
