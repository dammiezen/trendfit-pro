# TrendFit Pro — Brand Audit Studio

Prepared for your Universal Brand Marketing Strategist workflow. This is a runnable application package, not a published replacement for the existing GitHub Pages calculator.

## What happens when you enter links

Add a website and/or official public social profiles for one brand, choose a target market and calendar start date, then select **Audit this brand**. The app automatically runs your `/audit` prompt and the exact updated skill supplied on 13 November 2026. You do not need to paste the prompt each time.

The workflow reads accessible public evidence, researches buyers, competitors and current trends, creates the skill's 18 report sections, and generates 30 dated content drafts. Each calendar entry includes a pillar, persona, funnel stage, hooks, full copy, creative instructions, caption, CTA, destination, hashtags when relevant, required assets, KPI and approval status.

It flags unknown information, uses the updated weighted trend score out of 100, and holds or rejects unsafe trends regardless of score. No publishing, scheduling, client-account editing or outbound messaging tools are included.

The original calculator is preserved at `/calculator.html`. It is a legacy manual tool with the former 25-point scoring system, separate from the new audit workflow.

## Before activation

You need:

1. A computer or private web host that runs Node.js 22 or newer continuously.
2. An OpenAI API project with a usable API key, model access and billing/usage allowance.
3. A long, unique workspace access password.

The app runs without a key in **Setup required** mode so you can explore the clearly labelled fictional sample. It cannot perform real AI audits until configured. API usage may incur charges. A full audit currently uses up to eight model requests: research, strategy and six five-day calendar batches. Review your API account's usage limits before activation.

GitHub Pages hosts static files; it cannot run this private Node service. The simplest deployment is to host the entire package together at one HTTPS address. Keep the existing GitHub Pages calculator live until the new service has passed a real audit. See [GitHub's Pages explanation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Run on your computer

Unzip the package, open a terminal in the `trendfit-pro` folder, then run:

```sh
npm ci
cp .env.example .env
```

Open `.env` in a text editor and fill in:

```dotenv
OPENAI_API_KEY=your_private_API_key
OPENAI_MODEL=gpt-6-astra
AUDIT_PASSWORD=your_unique_long_workspace_password
PORT=3000
NODE_ENV=development
APP_ORIGIN=http://localhost:3000
```

The values above are placeholders, not working credentials. Choose a model available to your account that supports Responses web search and structured outputs. Never put an API key in `public/`, a browser field, a screenshot or a GitHub commit. `.env` is excluded from the source package and from Git.

Run:

```sh
npm start
```

Open **http://localhost:3000**, unlock with your workspace password, add the brand links and run the audit. Keep the server and browser tab open while it finishes. A full report can take several minutes. Each real processing stage appears in the interface. Export the finished report before closing the tab.

If port 3000 is in use, change both `PORT` and the port in `APP_ORIGIN` to the same free port.

## Put it on private hosting

Use a persistent Node web service or the included Dockerfile. This version is designed for a single instance and a private operator, not a public multi-tenant SaaS.

- Application root: the `trendfit-pro` directory.
- Install/build command: `npm ci --omit=dev`.
- Start command: `npm start`.
- Runtime: Node.js 22 or newer.
- Environment: `NODE_ENV=production`.
- Private secrets: `OPENAI_API_KEY`, `OPENAI_MODEL` and `AUDIT_PASSWORD`.
- `AUDIT_PASSWORD`: at least 20 characters in production.
- `APP_ORIGIN`: the exact HTTPS app origin, for example `https://audit.yourdomain.com`, with no trailing slash or subpath.
- Port: use the host's assigned `PORT`; the service listens on it.
- Health check: `GET /api/status` returns a status object without exposing keys.

HTTPS must terminate at the host. Serve the interface and API from the same origin. Do not deploy this version as a static site or a short-lived serverless function: jobs continue in memory while the browser polls. Use one continuously running instance, or add a shared queue/session store before scaling.

The included Dockerfile is an alternative packaging route. Docker deployment itself has not been exercised here.

Do not upload the entire project root as a GitHub Pages artifact. Only `public/` is browser-facing. The source skill and private service files belong on the server.

## First live acceptance check

After adding credentials and hosting:

1. Confirm the banner changes from Setup required to Private workspace.
2. Unlock the workspace and run an audit on a public website you own or are authorised to review.
3. Confirm the coverage list shows exactly which pages were read and which failed.
4. Check several findings against their linked evidence. Public brand claims are not independently verified performance results.
5. Confirm all 18 report sections and all 30 dated drafts appear, and that copy, destinations and brand voice are appropriate.
6. Try a restricted social profile. It should disclose the access limit and request pasted content when necessary, rather than pretend to see the whole feed.
7. Confirm the report exports correctly. Check API usage/cost in your account.
8. Only then consider replacing the public site's link with the new app address.

A generated report still needs human review. “Needs Client Confirmation” is intentional, especially for offers, audience assumptions, proof, campaign dates and production capacity.

## What this version can and cannot inspect

- Website: up to eight selected HTML pages, prioritising the homepage and useful linked pages. This is a bounded text sample, not a full crawl.
- Social: attempts the supplied profile and up to 19 discoverable post links. It reports the actual number of individually read posts. The target from your skill is 20–30 recent accessible posts, but this implementation cannot guarantee that coverage or recency.
- No login bypass, CAPTCHA bypass, authenticated social API, full feed pagination, video viewing, image analysis, mobile rendering test or performance benchmark is implemented.
- Social platforms often block automated reading. You can supply profile copy and representative posts with dates/URLs under additional context. These are labelled client-provided.
- Public research uses the OpenAI web-search tool and citations. Its excerpts are labelled research summaries, not verbatim original-source quotations. It does not establish private analytics or a complete post history.
- Private reach, saves, retention, lead quality, sales, ROI and scheduled posts are unknown unless supported by user-supplied context. There are no analytics integrations in this package.
- A trend needs dated cited research to be ranked; candidates without a publication date or older than 90 days are left out of ranked opportunities. This conservative application rule prevents old evidence being presented as current.
- Each audit is isolated. There is no durable client database, approved-strategy retrieval, multi-user role system or persistent brand memory. The report exports a reusable brand profile; supply approved context for a future audit.
- All 30 days are proposed drafts. Daily frequency is a planning assumption, not approval to publish daily.
- Redirects between the bare and `www` domain are supported; redirects to unrelated domains are not followed by the page reader. Paste the final official URL if needed.

## Data handling and access

The API key remains on the server. The password creates an HTTP-only, same-site session cookie. Audit jobs are readable only by their initiating session. Completed reports expire from server memory after 30 minutes (cleanup runs once a minute); the browser keeps its displayed report until cleared or closed. Restarting the service loses sessions and jobs. No report files or client context are written to disk by the app.

The API requests use `store: false`; this is not a promise of zero retention by the AI provider. Review the provider's account-specific data policies. Do not submit confidential customer records or credentials. The app asks for acknowledgement before sending content to the AI service.

The page reader validates public HTTPS destinations, pins DNS results, rejects private-network targets, bounds response sizes and follows robots restrictions. The service limits concurrent and hourly audits. These are single-instance controls, not a replacement for production monitoring or organisational access management.

## Skill and workflow files

- `server/strategy.md`: exact updated uploaded skill. SHA-256: `698b190c6b61831bdab1f303b705096f953ecf1a9cb241f9591a31c5bac61278`.
- `server/workflow.js`: your `/audit` command and prompt, with submitted links inserted automatically.
- `server/audit.js`: public research, strategy and complete-calendar stages.
- `server/schema.js`: required report fields, evidence checks, weighted scoring and 30-day completeness validation.
- `public/`: interface, export, fictional sample and preserved legacy calculator.

The skill is included in every AI stage. Its hash is attached to every report so the applied version is traceable. Website text is treated as untrusted source material, not as instructions.

The command is a workflow convention implemented by this app. It does not depend on installing a ChatGPT skill or typing a slash command into the form.

## Verification performed

- Automated tests cover URL/private-network rejection, extraction, robots restrictions, bounded coverage, source validation, weighted scoring and safety overrides, exact workflow selection, incomplete AI responses, all 18 sections, all 30 days and session-isolated API jobs.
- Browser checks confirmed the setup state, multi-link form, sample report and 30-day calendar.
- The exported sample report was downloaded and checked for all 18 sections and 30 calendar entries.
- The source skill was verified byte-for-byte against your uploaded file.
- **Live AI requests have not been run:** no API key was supplied. Model availability, report quality, actual API cost and production deployment require the acceptance check above. Automated AI pipeline tests use simulated responses.

Run checks again after changes:

```sh
npm run check
npm test
```

## Implementation references

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GitHub Pages static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
