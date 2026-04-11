# Redesign: Snapshot View (Model Registry)

The objective is to overhaul the Snapshot View page (`SnapshotManager.jsx`) to align with the modern, high-tech FUI (Future UI) aesthetic established in the Load Analytics dashboard. The design will focus on glassmorphism, precise typography, and a "mission control" layout.

## User Review Required

> [!IMPORTANT]
> The redesign will transition from a traditional table list to a more dynamic "card-blade" sequence. This improves readability on large screens but changes the dense information density slightly.

## Proposed Changes

### [Frontend] Snapshot View Redesign

#### [MODIFY] [SnapshotManager.jsx](file:///Volumes/externalDrive/code-gym/powersystem/frontend/src/components/SnapshotManager.jsx)
- **Top Header**: Standardize with a sleek "REGISTRY_OVERVIEW" breadcrumb and a prominent technical search bar.
- **KPI Metrics**: Redesign `StatCard` to use subtle glass backgrounds, gradient borders, and technical data labels (e.g., "MDR_01", "SYNC_STATE").
- **Snapshot Registry List**:
    - Replace the standard headered-table with a list of "Technical Blades" (horizontal cards).
    - Status indicators will use high-contrast neon glows (Cyan for Active, Dimmed White for Archived).
    - Hover effects will include a subtle cyan border expansion.
- **Import Modal**: 
    - Full-screen blurred backdrop.
    - Glassmorphic center panel with improved file-drop typography.
- **Animations**: Use `framer-motion` for staggered list entry and smooth modal transitions.

#### [MODIFY] [ImportSummaryView.jsx](file:///Volumes/externalDrive/code-gym/powersystem/frontend/src/components/ImportSummaryView.jsx)
- Update styling of the summary breakdown (node counts, topology stats) to match the new high-tech look.

## Verification Plan

### Automated Tests
- Use the browser tool to navigate to `/snapshots` (view=snapshots).
- Verify the following:
    - [ ] KPI cards render with high-quality icons and labels.
    - [ ] Snapshot list is readable and responsive.
    - [ ] "Activate" action triggers the success toast and updates the visual state (neon glow).
    - [ ] "Upload" modal opens with a sleek glass effect.

### Manual Verification
- Confirm with the user that the "professional" look meets their expectations compared to the previous version.
