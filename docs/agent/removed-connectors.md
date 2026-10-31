# Connectors removed on purpose

## WhatsApp (removed, do not re-add)

WhatsApp's API cannot be scoped to business conversations only. Connecting it would pull the partners' personal chats into a
business tool. It was removed deliberately, not because it was unused: the connector row, its status and every mention that
offered it are gone, and the agent is told never to offer it. Guest and partner messages go through Guest messaging, Gmail and
Outlook, and always wait for a partner to approve them.

(The public marketing site's "Chat on WhatsApp" links are unrelated: they are a customer-facing contact number, not a Copilot connector.)

## Cursor (removed)

Cursor used to run saved skills and sat behind a connector row, a spend card and a model choice. Skills now run on the Copilot
brain (`shared/copilot/skillRunner.ts`, through `shared/copilot/brain.ts`), with the same tools and the same approvals: nothing
sends without a partner pressing the button. The Cursor SDK, `CURSOR_API_KEY`, `CURSOR_ADMIN_API_KEY`, `COPILOT_TOOLS_SECRET` and
`COPILOT_TOOLS_URL` are no longer used and can be deleted from Vercel. The `agent_id` and `cursor_run_id` columns on `copilot_runs`
are unused; they are left in the table and can be dropped any time.
