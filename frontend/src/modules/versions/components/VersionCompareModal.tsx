import React, { useState, useEffect } from 'react';
import { ProductionVersion } from '@/types/production';
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
  const [versionA, setVersionA] = useState<ProductionVersion>(version);
  const [versionB, setVersionB] = useState<ProductionVersion>(version);

  useEffect(() => {
    if (!isOpen || !version) return;
    setVersionA(version);

    // Prefer a sibling version of the same shot or task
    const siblingVersion =
      allVersions.find(
        (v) =>
          v.id !== version.id &&
          ((v.shot_id && v.shot_id === version.shot_id) ||
            (v.asset_id && v.asset_id === version.asset_id) ||
            (v.task_id && v.task_id === version.task_id))
      ) ||
      allVersions.find((v) => v.id !== version.id) ||
      version;

    setVersionB(siblingVersion);
  }, [version, allVersions, isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compare: ${versionA?.version_number || 'Current'} vs ${versionB?.version_number || 'Reference'}`}
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
