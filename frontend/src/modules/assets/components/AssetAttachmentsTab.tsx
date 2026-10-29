import { useAttachments, useAttachmentMutations } from '@/modules/attachments';
import type { Asset } from '@/types/production';

import React from 'react';


import { AttachmentList } from '@/shared/components/attachments/AttachmentList';

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
