# Vernon Schedule System

Staff availability and event scheduling built with Next.js, TypeScript, and Tailwind CSS.

## Supabase Setup

1. Create a project in Supabase.
2. In the Supabase project settings, copy the Project URL and anon/public key.
3. Copy `.env.example` to `.env.local`.
4. Replace the placeholder values in `.env.local` with the Project URL and anon/public key.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

The `.env.local` file is ignored by Git and must not be committed.
