import { KnowledgeDocument } from '@/types/intelligence';

export const mockKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: 'kdoc-001',
    title: 'OpenUSD 24.08 Multi-Department Asset Composition Standard',
    slug: 'openusd-asset-composition-standard',
    summary: 'Core pipeline specification for USD layer stacking, sublayering, payload referencing, and variant sets across modeling, shading, and layout.',
    category: 'pipeline',
    department_name: 'Pipeline & Tooling',
    project_code: 'ALL',
    tags: ['USD', 'OpenUSD', 'Pipeline', 'Payloads', 'Solaris', 'Houdini'],
    author_name: 'Dr. Elena Rostova',
    author_role: 'Chief Technology Officer',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    version: 'v2.4.1',
    is_pinned: true,
    is_verified: true,
    views_count: 1420,
    likes_count: 89,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-08-10T14:22:00Z',
    linked_entities: [
      {
        id: 'klink-001',
        target_entity_type: 'asset',
        target_entity_id: 'ast-001',
        target_entity_title: 'Hero Mech Titan Alpha',
        target_entity_code: 'AST_TITAN',
        relationship_type: 'governed_by',
      },
      {
        id: 'klink-002',
        target_entity_type: 'project',
        target_entity_id: 'proj-001',
        target_entity_title: 'Nebula Knights',
        target_entity_code: 'NK99',
        relationship_type: 'applies_to',
      },
    ],
    content_markdown: `# OpenUSD 24.08 Asset Composition Standard

## Executive Summary
This document establishes the mandatory **Universal Scene Description (USD)** layering conventions for all internal studio artists and external vendor deliverables across visual effects productions.

---

## 1. USD Hierarchy & Stage Conventions

Every asset must be authored under a single default root primitive named after the asset slug in PascalCase:

\`\`\`usda
#usda 1.0
(
    defaultPrim = "TitanAlpha"
    metersPerUnit = 0.01
    upAxis = "Y"
)

def Xform "TitanAlpha" (
    assetInfo = {
        string identifier = "NK99_AST_TITAN_01"
        string version = "v024"
    }
    kind = "component"
)
{
    def Scope "geo"
    {
        # Primary subdivision geometry meshes
    }
    def Scope "mtl"
    {
        # MaterialX shading graphs
    }
}
\`\`\`

### Key Layering Rules:
1. **Payloads for Heavy Geo**: All high-density poly meshes (>500k polys) MUST be authored in a payload sublayer (\`_payload.usd\`) to allow fast viewport layout loading.
2. **MaterialX Integration**: Shaders must utilize standard **UsdPreviewSurface** or **MaterialX 1.38** graphs for cross-engine compatibility with Houdini Karma and Unreal Engine 5.5.
3. **Variant Sets**: Level of Detail (LOD) and damage states must be exposed through explicit variant sets:
   - \`lodVariants\`: \`high\`, \`mid\`, \`low\`, \`proxy\`
   - \`damageVariants\`: \`pristine\`, \`battle_worn\`, \`heavy_damage\`

---

## 2. Departmental Publishing Matrix

| Department | Target Layer | Allowed Prims | Prohibited |
| :--- | :--- | :--- | :--- |
| **Modeling** | \`geo.usd\` | \`UsdGeomMesh\`, \`UsdGeomPoints\` | Hardcoded shader bindings |
| **Grooming** | \`groom.usd\` | \`UsdGeomCurves\`, \`UsdGeomBasisCurves\` | Raw non-instanced hairs |
| **LookDev** | \`mtl.usd\` | \`UsdShadeMaterial\`, \`MaterialX\` | Baked non-ACES textures |
| **Rigging** | \`rig.usd\` | \`UsdSkelRoot\`, \`UsdSkelSkeleton\` | Unpinned skeleton roots |

---

## 3. QA Automated Validation Checkpoints
Before publishing via the StudioHub publisher, ensure your export passes:
- Zero unreferenced external disk paths.
- All textures reside in the standardized ACEScg \`.tx\` or \`.exr\` directory.
- Up-axis is strictly set to **Y-Up**.
`,
  },
  {
    id: 'kdoc-002',
    title: 'Compositing SOP: 32-bit Deep EXR Multi-Channel Merging',
    slug: 'compositing-sop-deep-exr-merge',
    summary: 'Standard operating procedure for handling Nuke 15 deep composite layers, volumetrics, and depth-of-field z-defocus blending.',
    category: 'sop',
    department_name: 'Compositing',
    project_code: 'ALL',
    tags: ['Nuke', 'Compositing', 'Deep EXR', 'Cryptomatte', 'Z-Defocus'],
    author_name: 'Marcus Vance',
    author_role: 'Head of 2D & Compositing',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    version: 'v3.1.0',
    is_pinned: true,
    is_verified: true,
    views_count: 980,
    likes_count: 64,
    created_at: '2026-02-18T11:30:00Z',
    updated_at: '2026-07-29T16:45:00Z',
    linked_entities: [
      {
        id: 'klink-003',
        target_entity_type: 'shot',
        target_entity_id: 'shot-001',
        target_entity_title: 'NK99-010-010: Asteroid Belt Chase',
        target_entity_code: 'NK99_010_010',
        relationship_type: 'documentation_for',
      },
      {
        id: 'klink-004',
        target_entity_type: 'task',
        target_entity_id: 'task-001',
        target_entity_title: 'Final Comp & Deep Integration',
        relationship_type: 'referenced_by',
      },
    ],
    content_markdown: `# Compositing SOP: 32-bit Deep EXR Multi-Channel Merging

## Objective
Preserve volumetric edge fidelity, accurate motion blur, and sub-pixel edge sampling when combining Houdini Pyro dust/explosions with foreground CG ships and live-action plates.

---

## 1. Node Graph Template Architecture

1. **Plate Pre-grade**: Always linearize camera raw using the matching **ACEScc to ACEScg** IDT.
2. **DeepMerge Setup**:
   - Merge foreground CG deep streams using \`DeepMerge\` in \`merge\` mode.
   - For volumetric smoke and atmospheric haze, pass through \`DeepToPoints\` only for spatial sanity verification.
3. **Cryptomatte Channel Extraction**:
   - Never use manual luminance keys on beauty passes.
   - Extract isolation mattes using the studio standardized \`CryptoAsset\` and \`CryptoMaterial\` layers.

---

## 2. Mandatory Output Checks
- [ ] No NaN or infinite pixel values across the entire shot frame range.
- [ ] Grain matched precisely to plate ISO metadata (\`GrainMatcher\` gizmo).
- [ ] Black levels clamped to calibrated master plate black offset (\`0.0038\` on Arri Alexa 35).
- [ ] Clean EXR metadata passed through with frame rate \`24.00 fps\` and ACEScg chromaticities.
`,
  },
  {
    id: 'kdoc-003',
    title: '[NK99] Nebula Knights: Sequence 010 Space Battle Production Direction',
    slug: 'nk99-seq010-production-notes',
    summary: 'Executive VFX Supervisor notes on cinematic camera optics, thruster FX color palettes, and hero ship continuity for sequence 010.',
    category: 'project_knowledge',
    department_name: 'VFX Supervision',
    project_code: 'NK99',
    tags: ['NK99', 'Sequence 010', 'VFX Supervisor', 'Direction', 'Anamorphic', 'Palette'],
    author_name: 'Prafull Sakharkar',
    author_role: 'VFX Supervisor / Studio Lead',
    author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    version: 'v1.5.0',
    is_pinned: true,
    is_verified: true,
    views_count: 1890,
    likes_count: 112,
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-08-22T10:15:00Z',
    linked_entities: [
      {
        id: 'klink-005',
        target_entity_type: 'project',
        target_entity_id: 'proj-001',
        target_entity_title: 'Nebula Knights',
        target_entity_code: 'NK99',
        relationship_type: 'documentation_for',
      },
      {
        id: 'klink-006',
        target_entity_type: 'shot',
        target_entity_id: 'shot-002',
        target_entity_title: 'NK99-010-020: Capital Ship Warp In',
        target_entity_code: 'NK99_010_020',
        relationship_type: 'applies_to',
      },
      {
        id: 'klink-007',
        target_entity_type: 'shot',
        target_entity_id: 'shot-003',
        target_entity_title: 'NK99-010-030: Missile Barrage Launch',
        target_entity_code: 'NK99_010_030',
        relationship_type: 'applies_to',
      },
    ],
    content_markdown: `# [NK99] Sequence 010: Space Battle Production Direction

## Director & Supervisor Creative Intent
Sequence 010 represents the primary set piece for Act II of *Nebula Knights*. The battle takes place amidst the dense rings of Saturn with heavy ice boulder scattering and harsh directional solar backlighting.

---

## 1. Visual & Lighting Rules

- **Key Light**: Intense, high-contrast directional sunlight (\`5600K\`, intensity 12.5). No ambient fill in hard vacuum—bounce lighting must originate solely from planetary ring albedo.
- **Thruster Trails**: Plasma exhaust glows must follow the cyan-to-violet energetic spectrum (\`#00f0ff\` transitioning to \`#8a2be2\`). Avoid standard campfire orange fire.
- **Lens Distortion Profile**: Panavision C-Series 2.0x Anamorphic squeeze profile. Ensure horizontal oval bokeh flares with organic chromatic aberration on high-specular highlights.

---

## 2. Sequence Continuity Milestones
- **Shot 010-010**: Fighter enters frame left, pulls high-G evasion maneuver. Asteroid debris velocity: 45 m/s.
- **Shot 010-020**: Capital ship dreadnought warps in with gravitational lensing ripple distortion.
- **Shot 010-030**: 40x micro-missile salvos ignite simultaneously. Frame rate ramping from 24fps to 96fps slow motion.
`,
  },
  {
    id: 'kdoc-004',
    title: 'Matchmove & Tracking Camera Calibration Procedure',
    slug: 'matchmove-camera-calibration-procedure',
    summary: '3DEqualizer and Syntheyes pipeline procedures for lens grid solving, anamorphic undistortion, and survey point alignment.',
    category: 'sop',
    department_name: 'Matchmove & Tracking',
    project_code: 'ALL',
    tags: ['Matchmove', '3DEqualizer', 'Tracking', 'Lens Distortion', 'Camera'],
    author_name: 'Kenji Sato',
    author_role: 'Lead Matchmove Artist',
    version: 'v2.0.0',
    is_pinned: false,
    is_verified: true,
    views_count: 540,
    likes_count: 38,
    created_at: '2026-04-12T14:00:00Z',
    updated_at: '2026-06-18T09:30:00Z',
    linked_entities: [
      {
        id: 'klink-008',
        target_entity_type: 'task',
        target_entity_id: 'task-003',
        target_entity_title: '3D Camera Track & Lens Grid Solve',
        relationship_type: 'governed_by',
      },
    ],
    content_markdown: `# Matchmove Camera Calibration Procedure

## Solving Workflow in 3DEqualizer 4
1. **Lens Grid Warping**: Calculate radial and anamorphic squeeze distortion from on-set checkerboard grid clips.
2. **Point Cloud Tracking**: Achieve sub-pixel residual error (< 0.45 pixels) across all keyframe anchor points.
3. **Survey Point Constraint**: Align coordinate space to on-set LiDAR point clouds before publishing USD camera schemas.
`,
  },
  {
    id: 'kdoc-005',
    title: 'Client Turnover & Secure Aspera Delivery Security Guidelines',
    slug: 'client-turnover-aspera-security-guidelines',
    summary: 'Strict MPAA and studio TPN-compliant protocols for watermarking, EXR packaging, and secure tokenized Aspera transmission.',
    category: 'client_guidelines',
    department_name: 'Editorial & Delivery',
    project_code: 'ALL',
    tags: ['Delivery', 'Aspera', 'Security', 'TPN', 'Watermarking', 'EXR'],
    author_name: 'Sarah Jenkins',
    author_role: 'Head of Production Delivery',
    version: 'v4.0.0',
    is_pinned: false,
    is_verified: true,
    views_count: 720,
    likes_count: 51,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-08-01T15:00:00Z',
    linked_entities: [
      {
        id: 'klink-009',
        target_entity_type: 'client',
        target_entity_id: 'cli-001',
        target_entity_title: 'Paramount Global Pictures',
        relationship_type: 'governed_by',
      },
      {
        id: 'klink-010',
        target_entity_type: 'delivery',
        target_entity_id: 'del-001',
        target_entity_title: 'NK99 Act 1 Final EXR Turnover',
        relationship_type: 'applies_to',
      },
    ],
    content_markdown: `# Client Turnover & Aspera Delivery Security Guidelines

## Security Checklist for All External Dispatches
- [ ] Invisible forensic steganographic audio/video watermark injected via CineCode.
- [ ] Visible burned-in studio recipient watermark (\`CONFIDENTIAL - PARAMOUNT REVIEW\`).
- [ ] SHA-256 checksum manifest generated and signed for each tar/zip container.
- [ ] Transfers routed exclusively through dedicated high-speed encrypted Aspera Faspex nodes.
`,
  },
  {
    id: 'kdoc-006',
    title: '[DUNE] Arrakis Desert Atmosphere & Spice Particulate Simulation Guide',
    slug: 'dune-desert-spice-simulation-guide',
    summary: 'Houdini 20.5 FLIP and pyro setup for micro-spice particle shimmering and dynamic dune sand displacement under ornithopter rotor wash.',
    category: 'pipeline',
    department_name: 'FX Simulation',
    project_code: 'DUNE',
    tags: ['DUNE', 'Houdini', 'FX', 'Spice', 'Sand', 'Pyro', 'VDB'],
    author_name: 'Dr. Elena Rostova',
    author_role: 'Chief Technology Officer',
    version: 'v1.2.0',
    is_pinned: false,
    is_verified: true,
    views_count: 860,
    likes_count: 75,
    created_at: '2026-05-10T12:00:00Z',
    updated_at: '2026-08-14T11:20:00Z',
    linked_entities: [
      {
        id: 'klink-011',
        target_entity_type: 'project',
        target_entity_id: 'proj-002',
        target_entity_title: 'Dune: The Sisterhood',
        target_entity_code: 'DUNE',
        relationship_type: 'documentation_for',
      },
    ],
    content_markdown: `# [DUNE] Arrakis Atmosphere & Spice Simulation

## Micro-particulate Behavior
Spice particulates require a dual-frequency turbulence noise in Houdini POPS:
- **Low Frequency**: Driven by thermal updrafts off 55°C desert sand.
- **High Frequency Sparkle**: Driven by microscopic prismatic refraction with ACEScg specular sheen.
`,
  },
];
