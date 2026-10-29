import { versionService, VERSION_KEYS } from '@/modules/versions';

import React, { useState } from 'react';

import { Shot } from '@/types/production';

import { Modal } from '@/shared/components/Modal';

import { Button } from '@/shared/components/Button';

import { Input } from '@/shared/components/Input';

import { useQueryClient } from '@tanstack/react-query';

import { useNotificationStore } from '@/shared/stores/useNotificationStore';

import { useActivityStore } from '@/shared/stores/useActivityStore';

export interface ShotSubmitVersionModalProps {

  isOpen: boolean;

  onClose: () => void;

  shot: Shot;

}

export const ShotSubmitVersionModal: React.FC<ShotSubmitVersionModalProps> = ({

  isOpen,

  onClose,

  shot,

}) => {
  const recordActivity = useActivityStore((state) => state.recordActivity);

  const queryClient = useQueryClient();

  const { addNotification } = useNotificationStore();

  const [versionNumber, setVersionNumber] = useState('v002');

  const [department, setDepartment] = useState(shot.department || 'Compositing');

  const [artistName, setArtistName] = useState(shot.assigned_artist_name || 'Elena Rostova');

  const [fileFormat, setFileFormat] = useState('OpenEXR 16-bit float');

  const [comment, setComment] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setIsSubmitting(true);

    try {

      const versionCode = `${shot.code}_${department.toLowerCase().slice(0, 4)}_${versionNumber}`;

      const created = await versionService.createVersion({
        code: versionCode,
        version_number: versionNumber,
        version_index: parseInt(String(versionNumber).replace(/\D/g, ''), 10) || 1,
        entity_id: shot.id,

        entity_type: 'shot',

        entity_name: shot.code,

        project_id: shot.project_id,

        project_code: shot.project_code,

        department,

        status: 'Ready for Review',

        artist_name: artistName,

        comment: comment || `Version ${versionNumber} submitted from Shot Workspace.`,

        frame_in: shot.frame_in,

        frame_out: shot.frame_out,

        frame_count: shot.frame_count,

        file_path: `/volumes/renders/${shot.project_code}/${shot.sequence_code}/${shot.code}/${department.toLowerCase()}/${versionCode}/%04d.exr`,

        media_type: 'Render',

      } as any);

      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.all });

      recordActivity({

        action: 'created',

        actionLabel: 'Version Submitted',

        resourceType: 'version',

        resourceId: created?.id || `ver-${Date.now()}`,

        resourceName: versionCode,

        resourceCode: versionCode,

        projectId: shot.project_id,

        context: shot.code,

        description: `Artist ${artistName} submitted ${versionCode} for ${shot.code}.`,

        tags: ['Version', 'Submission'],

      });

      addNotification({

        type: 'success',

        title: 'Version Submitted',

        message: `${versionCode} queued for dailies and review session.`,

      });

      onClose();

    } catch (err) {

      addNotification({

        type: 'error',

        title: 'Submission Failed',

        message: 'Could not submit new version.',

      });

    } finally {

      setIsSubmitting(false);

    }

  };

  return (

    <Modal isOpen={isOpen} onClose={onClose} title={`Submit Version for ${shot.code}`} size="md">

      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">Version Number</label>

            <Input

              value={versionNumber}

              onChange={(e) => setVersionNumber(e.target.value)}

              placeholder="e.g. v002"

              required

              className="font-mono"

            />

          </div>

          <div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>

            <select

              value={department}

              onChange={(e) => setDepartment(e.target.value)}

              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"

            >

              <option value="Compositing">Compositing</option>

              <option value="Lighting">Lighting</option>

              <option value="FX">FX</option>

              <option value="Animation">Animation</option>

              <option value="Layout">Layout</option>

              <option value="Matte Painting">Matte Painting</option>

            </select>

          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">Submitting Artist</label>

            <Input

              value={artistName}

              onChange={(e) => setArtistName(e.target.value)}

              placeholder="Artist name..."

              required

            />

          </div>

          <div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">Delivery Format</label>

            <select

              value={fileFormat}

              onChange={(e) => setFileFormat(e.target.value)}

              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"

            >

              <option value="OpenEXR 16-bit float">OpenEXR 16-bit float (ACEScg)</option>

              <option value="Apple ProRes 4444 XQ">Apple ProRes 4444 XQ</option>

              <option value="OpenUSD Stage (usda/usdc)">OpenUSD Stage (usda/usdc)</option>

              <option value="DNxHR HQX">DNxHR HQX</option>

            </select>

          </div>

        </div>

        <div>

          <label className="block text-xs font-semibold text-slate-300 mb-1">Turnover / QC Comment</label>

          <textarea

            value={comment}

            onChange={(e) => setComment(e.target.value)}

            rows={3}

            placeholder="Describe fixes, color changes, matte refinements or layer inclusions in this version..."

            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"

          />

        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">

          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>

            Cancel

          </Button>

          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>

            Publish & Queue Review

          </Button>

        </div>

      </form>

    </Modal>

  );

};
