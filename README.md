# TagnetIQ - v9.0.2

Welcome to the TagnetIQ monorepo. This project is a Vite-powered React application designed to be the "Bloomberg Terminal for Physical Assets," providing AI-driven analysis and market insights.

## Core Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS with shadcn/ui components
- **Backend:** Supabase (Auth, Postgres, Storage)
- **API Layer:** Serverless functions deployed via Vercel

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project created

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd tagnetiq-final-review
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    -   Create a new file named `.env` in the root of the project.
    -   Copy the contents of `.env.example.txt` into your new `.env` file.
    -   Fill in the required values for your Supabase project and any other API keys (like `ATTOM_API_KEY`).

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

### Key Features

- **Dynamic Theming:** 8 distinct visual themes with a seasonal branding overlay, configurable from the settings menu.
- **Investor Suite:** A secure, read-only portal for investors with KPI dashboards and a data room.
- **Beta Tester Suite:** A comprehensive system for managing beta testers, including invites, feedback submission, missions, and referrals.
- **Admin Consoles:** Dedicated dashboards for managing the Investor and Beta Tester programs.
- **AI-Powered Analysis:** A modular system for analyzing various asset categories, starting with a live Real Estate module.

### Admin Access

To gain admin privileges locally, you can use the built-in "Developer Shortcut" in `src/contexts/AuthContext.tsx` or add your Supabase user's email to the `ADMIN_EMAILS` list in the same file and use the standard login flow.