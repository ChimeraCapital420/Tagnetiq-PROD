# TagnetIQ Changelog

All notable changes to this project will be documented in this file.

## [9.0.2] - 2025-08-14

### Added

-   **Investor Suite:**
    -   Created a secure, token-based portal for investor access (`/investor`).
    -   Implemented an admin console (`/admin/investors`) for managing invites and viewing analytics.
    -   Added API endpoints for serving KPI data and managing invites.
    -   Included "Print to PDF" functionality for an investor one-pager.
-   **Beta Tester Suite:**
    -   Developed a full-featured beta program management system.
    -   Created a welcoming onboarding flow for new testers (`/beta/welcome`).
    -   Implemented an in-app feedback modal with automatic data tagging.
    -   Added pages for beta missions and referral tracking.
    -   Built an admin console (`/admin/beta`) with feedback triage, analytics, and an invite system.
-   **Dynamic Theming & Branding:**
    -   Implemented 8 distinct, high-resolution background themes.
    -   Added a seasonal branding toggle with animated overlays for Winter, Spring, Summer, and Fall.
    -   Created a `VersionBadge` and a one-time `VersionSplash` screen.
-   **Real Estate Module:**
    -   Built the UI component for displaying market comparisons (`MarketComps.tsx`).
    -   Created a live API endpoint (`/api/market-comps.ts`) that connects to the ATTOM API.
-   **Feature Flag System:**
    -   Implemented a database-driven feature flag system managed from the `BetaControls.tsx` page.
-   **Interactive Map:**
    -   Added a new admin page (`/admin/map`) with an interactive Mercator map for data visualization.

### Fixed

-   Resolved a persistent CSS layering issue that was obscuring background artwork.
-   Corrected all file pathing and import resolution errors.
-   Stabilized the application's core layout and styling foundation.