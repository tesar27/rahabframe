# RehabFrame

RehabFrame is a Next.js MVP for reviewing two rehabilitation exercise videos, generating a preliminary movement comparison, and keeping the analysis history in a ChatGPT-style workspace.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- TensorFlow.js MoveNet for client-side pose estimation
- Local JSON persistence for analysis history

## What This Prototype Does

- Lets a user choose a baseline and follow-up video
- Runs lightweight pose analysis in the browser
- Stores only derived metrics and generated reports on the server
- Renders a chat-style analytical summary with history on the left

Raw videos stay in the browser for this prototype. The server only receives summarized pose metrics and the generated report.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Notes

- The report is an automated movement summary, not a medical diagnosis.
- Local history is stored in `data/analyses.json` and is intended for MVP use on a persistent server or local machine.
