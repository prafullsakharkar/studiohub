import React from 'react';
import { Asset } from '@/types/assets';
import { AttachmentList } from '@/shared/components/attachments/AttachmentList';
import { useAttachments } from '@/modules/attachments/hooks/useAttachments';
import { useAttachmentMutations } from '@/modules/attachments/hooks/useAttachmentMutations';

interface AssetAttachmentsTabProps {
  asset: Asset;
}

export const AssetAttachmentsTab: React.FC<AssetAttachmentsTabProps> = ({ asset }) => {
  const { data: attachments = [], isLoading } = useAttachments({
    entity_type: 'asset',
    entity_id: asset.id,
  });
  const { createAttachment, deleteAttachment } = useAttachmentMutations();

  return (
    <div className="space-y-4">
      <AttachmentList
        attachments={attachments}
        isLoading={isLoading}
        onUpload={createAttachment}
        onDelete={deleteAttachment}
        entityType="asset"
        entityId={asset.id}
        entityCode={asset.code}
        projectId="proj-001"
        projectCode="NK99"
      />
    </div>
  );
};
