import React, { useState } from 'react';
import { ProductionVersion } from '@/types/versions';
import { MediaCompare } from '@/shared/components/media/MediaCompare';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';

interface VersionCompareModalProps {
  version: ProductionVersion;
  allVersions: ProductionVersion[];
  isOpen: boolean;
  onClose: () => void;
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  version,
  allVersions = [],
  isOpen,
  onClose,
}) => {
  // Find default previous version or first other version
  const otherVersion =
    allVersions.find((v) => v.id !== version.id && v.shot_id === version.shot_id) ||
    allVersions.find((v) => v.id !== version.id) ||
    version;

  const [versionA, setVersionA] = useState<ProductionVersion>(version);
  const [versionB, setVersionB] = useState<ProductionVersion>(otherVersion);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compare: ${versionA.version_number} vs ${versionB.version_number}`}
      size="2xl"
    >
      <div className="space-y-4">
        <MediaCompare
          versionA={versionA}
          versionB={versionB}
          allVersions={allVersions}
          onSelectVersionA={(v) => setVersionA(v)}
          onSelectVersionB={(v) => setVersionB(v)}
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Compare
          </Button>
        </div>
      </div>
    </Modal>
  );
};
