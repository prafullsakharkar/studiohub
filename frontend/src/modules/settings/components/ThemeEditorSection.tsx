import { useAuth } from '@/modules/auth';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { useThemeMode } from '@/providers/ThemeProvider';
;
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { DEFAULT_ACCENT_CYAN, DEFAULT_ACCENT_BLUE } from '@/types/identity';
import {
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  Save,
  Sliders,
  Eye,
  CheckCircle2,
  Lock,
  Layers,
  HelpCircle,
  Activity,
} from 'lucide-react';

export const ThemeEditorSection: React.FC = () => {
  const {
    accentCyan,
    accentBlue,
    activePresetId,
    setAccentColors,
    applyPreset,
    resetToDefaults,
    presets,
    mode,
    resolvedMode,
    toggleTheme,
  } = useThemeMode();

  const { user, updateUserProfile } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Local editing states for real-time fine tuning
  const [cyanColor, setCyanColor] = useState<string>(accentCyan);
  const [blueColor, setBlueColor] = useState<string>(accentBlue);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync local inputs if context changes (e.g. from preset click or external sync)
  useEffect(() => {
    setCyanColor(accentCyan);
    setBlueColor(accentBlue);
  }, [accentCyan, accentBlue]);

  const handleCyanChange = (val: string) => {
    setCyanColor(val);
    setAccentColors(val, blueColor, undefined);
  };

  const handleBlueChange = (val: string) => {
    setBlueColor(val);
    setAccentColors(cyanColor, val, undefined);
  };

  const handleApplyPreset = (presetId: string) => {
    applyPreset(presetId);
    const p = presets.find((pr) => pr.id === presetId);
    if (p) {
      setCyanColor(p.cyan);
      setBlueColor(p.blue);
    }
  };

  const handleReset = () => {
    resetToDefaults();
    setCyanColor(DEFAULT_ACCENT_CYAN);
    setBlueColor(DEFAULT_ACCENT_BLUE);
    addNotification({
      type: 'info',
      title: 'Theme Accents Reset',
      message: 'Restored standard Cyber Cyan & Electric Blue studio palette.',
    });
  };

  const handleSaveToProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const themePreferences = {
        accentCyan: cyanColor,
        accentBlue: blueColor,
        presetId: activePresetId,
        updatedAt: new Date().toISOString(),
      };

      await updateUserProfile({
        theme_preferences: themePreferences,
      });

      setSaveSuccess(true);
      addNotification({
        type: 'success',
        title: 'Theme Preferences Saved',
        message: "Your custom accent color preferences were saved to your user profile settings.",
      });

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not persist theme preferences to your profile. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDefault =
    cyanColor.toLowerCase() === DEFAULT_ACCENT_CYAN.toLowerCase() &&
    blueColor.toLowerCase() === DEFAULT_ACCENT_BLUE.toLowerCase();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Banner / Description */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${cyanColor}, ${blueColor})`,
            }}
          >
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Studio Color Theme & Accent Editor
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                Live Studio Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Fine-tune StudioHub's primary accent spectrum (<span className="text-cyan-400 font-mono">Cyan</span> /{' '}
              <span className="text-blue-400 font-mono">Blue</span>). All modifications apply instantaneously across
              buttons, badges, highlights, and active elements, and can be persisted to your user profile.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Button
            id="reset-theme-accents-btn"
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={isDefault}
            className="flex items-center gap-1.5"
            title="Reset to default StudioHub colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            id="save-theme-profile-btn"
            variant="primary"
            size="sm"
            onClick={handleSaveToProfile}
            disabled={isSaving}
            className="flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved to Profile!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save to Profile</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preset Palettes Grid */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Studio Color Preset Palettes
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select an engineered studio grade dual-tone palette calibrated for VFX color science.
            </p>
          </div>
        </CardHeader>

        <CardBody className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((preset) => {
              const isSelected =
                activePresetId === preset.id ||
                (cyanColor.toLowerCase() === preset.cyan.toLowerCase() &&
                  blueColor.toLowerCase() === preset.blue.toLowerCase());

              return (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`p-4 rounded-xl text-left border transition-all duration-200 group relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-white group-hover:text-cyan-300 transition-colors">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/40">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      {preset.description}
                    </p>
                  </div>

                  {/* Gradient Preview Bar */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <div
                      className="h-3.5 w-full rounded-md shadow-inner"
                      style={{
                        background: `linear-gradient(to right, ${preset.cyan}, ${preset.blue})`,
                      }}
                    />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.cyan }} />
                        {preset.cyan}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.blue }} />
                        {preset.blue}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Custom Color Fine-Tuning Sliders & Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color 1: Primary Cyan / Teal Accent */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Primary Accent 1 (Cyan Gradient Origin)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controls the start point of primary action buttons, focused tab underlines, and active icons.
            </p>
          </CardHeader>
          <CardBody className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  id="theme-accent-cyan-picker"
                  type="color"
                  value={cyanColor}
                  onChange={(e) => handleCyanChange(e.target.value)}
                  className="w-14 h-14 rounded-xl cursor-pointer border-2 border-slate-700 bg-transparent p-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  title="Click to pick custom color"
                />
              </div>

              <div className="flex-1 space-y-1">
                <label htmlFor="theme-accent-cyan-hex" className="text-xs font-mono text-slate-400">
                  HEX Color Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="theme-accent-cyan-hex"
                    type="text"
                    value={cyanColor}
                    onChange={(e) => handleCyanChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                    placeholder="#06b6d4"
                    maxLength={7}
                  />
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 border border-slate-700"
                    style={{ backgroundColor: cyanColor }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Swatches */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block mb-2">Recommended Swatches:</span>
              <div className="flex flex-wrap gap-2">
                {['#06b6d4', '#14b8a6', '#0ea5e9', '#38bdf8', '#10b981', '#00f2fe', '#22d3ee', '#8b5cf6'].map(
                  (hex) => (
                    <button
                      key={hex}
                      onClick={() => handleCyanChange(hex)}
                      className={`w-7 h-7 rounded-lg border transition-transform hover:scale-110 relative ${
                        cyanColor.toLowerCase() === hex.toLowerCase()
                          ? 'border-white ring-2 ring-cyan-500/50 scale-105'
                          : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      {cyanColor.toLowerCase() === hex.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-black absolute inset-0 m-auto" />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Color 2: Secondary Blue / Indigo Accent */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              Primary Accent 2 (Blue Gradient Target)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controls the end spectrum of gradients, interactive borders, and secondary telemetry badges.
            </p>
          </CardHeader>
          <CardBody className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  id="theme-accent-blue-picker"
                  type="color"
                  value={blueColor}
                  onChange={(e) => handleBlueChange(e.target.value)}
                  className="w-14 h-14 rounded-xl cursor-pointer border-2 border-slate-700 bg-transparent p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Click to pick custom color"
                />
              </div>

              <div className="flex-1 space-y-1">
                <label htmlFor="theme-accent-blue-hex" className="text-xs font-mono text-slate-400">
                  HEX Color Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="theme-accent-blue-hex"
                    type="text"
                    value={blueColor}
                    onChange={(e) => handleBlueChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                    placeholder="#3b82f6"
                    maxLength={7}
                  />
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 border border-slate-700"
                    style={{ backgroundColor: blueColor }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Swatches */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block mb-2">Recommended Swatches:</span>
              <div className="flex flex-wrap gap-2">
                {['#3b82f6', '#2563eb', '#1d4ed8', '#6366f1', '#4facfe', '#0284c7', '#f59e0b', '#ec4899'].map(
                  (hex) => (
                    <button
                      key={hex}
                      onClick={() => handleBlueChange(hex)}
                      className={`w-7 h-7 rounded-lg border transition-transform hover:scale-110 relative ${
                        blueColor.toLowerCase() === hex.toLowerCase()
                          ? 'border-white ring-2 ring-blue-500/50 scale-105'
                          : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      {blueColor.toLowerCase() === hex.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Live Interactive UI Preview */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Live Studio Component Preview
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Preview how your chosen accents harmonize with StudioHub buttons, badges, metrics, and navigation tags.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Mode:</span>
              <button
                onClick={toggleTheme}
                className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                {resolvedMode === 'dark' ? 'Dark Mode (Active)' : 'Light Mode (Active)'}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-6 space-y-6 bg-slate-950/50 rounded-b-xl">
          {/* Button Styles Row */}
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-3">
              Action Controls
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md">
                Primary Button Action
              </Button>
              <Button variant="secondary" size="md">
                Secondary Button
              </Button>
              <Button variant="outline" size="md">
                Outline Accent
              </Button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md text-white"
                style={{
                  background: `linear-gradient(to right, ${cyanColor}, ${blueColor})`,
                }}
              >
                Direct Gradient Render
              </button>
            </div>
          </div>

          {/* Badges & Metrics Row */}
          <div className="pt-4 border-t border-slate-800/80">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-3">
              Badges & Status Highlights
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-mono font-semibold text-white shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${cyanColor}, ${blueColor})`,
                }}
              >
                ACTIVE PRODUCTION
              </span>

              <span
                className="px-3 py-1 rounded-lg text-xs font-mono font-medium border"
                style={{
                  borderColor: cyanColor,
                  color: cyanColor,
                  backgroundColor: `${cyanColor}15`,
                }}
              >
                Border Accent 1: {cyanColor}
              </span>

              <span
                className="px-3 py-1 rounded-lg text-xs font-mono font-medium border"
                style={{
                  borderColor: blueColor,
                  color: blueColor,
                  backgroundColor: `${blueColor}15`,
                }}
              >
                Border Accent 2: {blueColor}
              </span>

              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900"
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: cyanColor }}
                />
                <span className="text-xs font-mono text-slate-300">Telemetry Pulse</span>
              </div>
            </div>
          </div>

          {/* Mini Card Preview */}
          <div className="pt-4 border-t border-slate-800/80">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-3">
              Card & Border Glow
            </span>
            <div
              className="p-4 rounded-xl border bg-slate-900/80 shadow-lg relative overflow-hidden max-w-md"
              style={{
                borderColor: `${cyanColor}60`,
                boxShadow: `0 4px 20px -2px ${cyanColor}20`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: `linear-gradient(to right, ${cyanColor}, ${blueColor})`,
                }}
              />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">Shot Sequence 102_040</span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                  style={{
                    backgroundColor: `${cyanColor}25`,
                    color: cyanColor,
                  }}
                >
                  COMPOSITING
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Render pass completed with high-fidelity depth layers. Custom accent coloring applied dynamically.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* User Profile Sync Status Info */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Connected to user profile account:{' '}
            <strong className="text-slate-200">
              {user?.full_name || user?.email || 'Active Studio Artist'}
            </strong>
            . Saved preferences persist across sessions and browser refreshes.
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 shrink-0">
          CSS Variables: --studio-accent-cyan, --studio-accent-blue
        </span>
      </div>
    </div>
  );
};
