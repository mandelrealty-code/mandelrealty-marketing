import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { passwordMatches } from "../adminAuth.js";
import { updatePmSettings } from "../pm/clientStore.js";
import { gmailConnected, gmailKeysReady } from "./gmail.js";
import { outlookConnected, outlookKeysReady } from "./outlook.js";
import { applyOpenItemOnBrief, dismissSavedCard, noteRankPass, quietBrief, readStoredBrief, refreshSavedBrief } from "../copilot/brief.js";
import { cleanerWebhookReady, twilioFromLabel, twilioReady } from "../copilot/cleanText.js";
import { accountSpend } from "../copilot/accounts.js";
import { answerSignIn, cancelCursorRun, collectCursorRun } from "../copilot/cursorThink.js";
import { beginSession, publishFindings, readPage, type SessionPage } from "../copilot/browserSession.js";
import { cancelBrowser, collectBrowser, browserIsLive, publicError, releaseBrowser, resumeBrowser, startBrowser } from "../copilot/webBrowser.js";
import { nameChat } from "../copilot/chatTitle.js";
import { pictureFor, wantsWeb, workModel } from "../copilot/models.js";
import { answerWebLookup, asksWebLookup } from "../copilot/webLookup.js";
import { asksFetchLookup, needsLiveBrowser, PAGE_UNREAD, runFetchLookup } from "../copilot/browserTier.js";
import { answerOutsideRentals } from "../copilot/topicScope.js";
import { skipsWeb } from "../copilot/route.js";
import { answerInboxToday } from "../copilot/mailInbox.js";
import { answerMailChain, asksMailBreakdown } from "../copilot/mailChain.js";
import type { WorkModelId } from "../copilot/models.js";
import { answerGeneral, answerPhoto, solveMath } from "../copilot/plainAnswer.js";
import { answerRecords, missingSourceAnswer } from "../copilot/recordsAnswer.js";
import { answerBuildingRegistration, answerRegistrationStatus } from "../copilot/buildingRegistration.js";
import { closeHandledAnswer, proveOutgoingMail } from "../copilot/partnerStandard.js";
import { parityNow } from "../copilot/parity/clock.js";
import { applyCorrections, takeCorrection } from "../copilot/corrections.js";
import { refuseCatalogPurchase } from "../copilot/catalogPurchase.js";
import { answerDayPlan, answerWeekCleans } from "../copilot/dayBoard.js";
import { answerStayDetail, openDaySheet, type StayCard } from "../copilot/stayAnswer.js";
import type { PropertyIdentity } from "../copilot/propertyIdentity.js";
import { pinnedCompanyAnswer } from "../copilot/pinnedAnswer.js";
import { answerPayout } from "../copilot/payoutAnswer.js";
import { answerPropertyReport } from "../copilot/reportAnswer.js";
import { isFilesystemError, REPORT_FILE_FAILURE } from "../copilot/fileError.js";
import { asksPropertyReport } from "../copilot/reportParse.js";
import { answerGuestThreads, answerNamedGuestDraft, answerWaitingDrafts } from "../copilot/guestInboxAnswer.js";
import { answerGuestStay } from "../copilot/guestStayAnswer.js";
import { answerPropertyFact } from "../copilot/propertyFact.js";
import { answerOps, asksCleanerAssignment, asksContractRevision, asksSop, cleanerFromWords, commitCleanerAssignment, commitContractResend, createOpsSop, prepareCleanerAssignment, prepareContractAmendment, sopFromWords } from "../copilot/ops.js";
import { answerPdfReport } from "../copilot/revenueReport.js";
import { answerOwnStore, asksClientList, CLIENT_STORE_EMPTY } from "../copilot/storeQuestions.js";
import { asksProposal, asksProposalEdit, asksProposalSend, commitProposalSend, editProposal, prepareProposalSend, proposalFromWords } from "../copilot/proposal.js";
import { commitPurchase, failedText, heldText, holdPurchase, offerAlternative, skippedText, skipPurchase } from "../copilot/purchase.js";
import { answerHospitable, applyHospitableEdit, ASKS_HOSPITABLE, commitHospitable } from "../copilot/hospitableAgent.js";
import { approveUpsell, releaseUpsell } from "../copilot/upsell.js";
import { cleanMcpToken, verifyHospitableMcpToken } from "../copilot/hospitableMcp.js";
import { disconnectHospitable, hospitableCard, hospitablePage, saveHospitableSelection, saveHospitableToken } from "../copilot/hospitableConnection.js";
import { loadReviewQueue, regenerateFromConnection, skipReview, submitReviewReply, undoSkip } from "../copilot/reviewsQueue.js";
import { beginInquiryVerify, forgetStandingAnswer, holdGuestThread, loadGuestQueue, markFollowUpHandled, openGuestAnswer, readSavedGuestQueue, saveStandingAnswer, submitGuestReply } from "../copilot/guestMessaging.js";
import { agreesToReply, asksAboutMail, declinesReply, deliverReply, mailDraftFromOffer } from "../copilot/mailReply.js";
import { deleteMemoryFile, listMemoryFiles, listStoredMemoryFiles, promptLines, takeMemoryTurn } from "../copilot/memoryFiles.js";
import { makePicture } from "../copilot/picture.js";
import { draftForCard, skillTurn } from "../copilot/reply.js";
import { skillFromWords, skillFromWorkflow } from "../copilot/skillShape.js";
import { CREATION_FAILED, reportSkillCreation, storedSkill } from "../copilot/skillPersist.js";
import { testWorkflow } from "../copilot/skillExecute.js";
import { missingNumber, type Workflow } from "../copilot/workflow.js";
import { chooseOpenItem, listOpenItems, openItemChoice } from "../copilot/openItems.js";
import { toE164 } from "../followUpSequences.js";
import {
  addMessage,
  addTextNumber,
  createChat,
  deleteChat,
  deleteSkill,
  listChats,
  listCursorRuns,
  listMemory,
  markChatSeen,
  listMessages,
  listOpenBrowsers,
  readMessage,
  ensureLegacyPurchase,
  listSkills,
  listTextLog,
  listTextNumbers,
  removeTextNumber,
  renameChat,
  saveSkill,
  saveStoredOpenItem,
  updateDraft,
} from "../copilot/store.js";
import type { ConnectorRow, SkillRow } from "../copilot/types.js";
import { runsOnItsOwn, startSkillRun } from "../copilot/skillRunner.js";
import { schedulePhrase, normalizeSchedule } from "../copilot/skillSchedule.js";
import { listRuns } from "../copilot/store.js";

const HOSPITABLE_TOOLS = ["guest_inbox", "list_stays", "read_guest_messages"];

async function skillRows(): Promise<SkillRow[]> {
  const skills = await listSkills();
  return Promise.all(
    skills.map(async (skill) => ({
      ...skill,
      lastRun: skill.kind === "playbook" ? ((await listRuns(skill.id, 1).catch(() => []))[0] ?? null) : null,
    })),
  );
}

function readImages(value: unknown): { mimeType: string; data: string }[] {
  if (!Array.isArray(value)) return [];
  const images: { mimeType: string; data: string }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const mimeType = String((item as { mimeType?: string }).mimeType ?? "");
    let data = String((item as { data?: string }).data ?? "");
    const comma = data.indexOf(",");
    if (data.startsWith("data:") && comma > 0) data = data.slice(comma + 1);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) continue;
    if (data.length < 32 || data.length > 1_800_000) continue;
    images.push({ mimeType, data });
    if (images.length === 4) break;
  }
  return images;
}

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Sign in required." });
}

function sessionPages(value: unknown): SessionPage[] {
  if (!Array.isArray(value)) return [];
  const pages: SessionPage[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as { title?: unknown; url?: unknown; note?: unknown; at?: unknown };
    const title = String(item.title ?? "").trim();
    const url = String(item.url ?? "").trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    pages.push({ at: String(item.at ?? ""), title, url, note: String(item.note ?? "") });
  }
  return pages.slice(0, 12);
}

function mcpSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not save the MCP token.";
  if (/hospitable_mcp_token|schema cache/i.test(message)) {
    return "The MCP token column is not on the database yet. Run supabase/pm_hospitable_mcp_token_v1.sql, then save the token again.";
  }
  return message;
}

async function hospitableMessage(
  chatId: string,
  model: WorkModelId,
  question: string,
  images: { mimeType: string; data: string }[],
): Promise<boolean> {
  const history = await listMessages(chatId);
  const prior = history
    .slice(0, -1)
    .slice(-6)
    .map((message) => `${message.role}: ${message.body.slice(0, 700)}`)
    .join("\n\n");
  const turn = await answerHospitable({ model, question, prior, facts: await factsFor(), images });
  if (!turn) return false;
  let body = turn.body;
  let draft = turn.draft;
  let thought = turn.thought;
  if (draft?.channel === "skill" && draft.skillKind !== "text") {
    body = await reportSkillCreation(draft, `${prior}\n${question}`);
    if (body === CREATION_FAILED) {
      draft = null;
      thought = "The creation failed.";
    } else {
      thought = "The skill is saved and off. Nothing was sent.";
    }
  }
  await addMessage({
    chatId,
    role: "assistant",
    body,
    steps: turn.steps,
    thought,
    draft,
    choices: turn.choices,
  });
  return true;
}

async function connectors(skills?: SkillRow[]): Promise<ConnectorRow[]> {
  const rows = skills ?? (await skillRows().catch(() => []));
  const readsGuests = rows.some(
    (skill) =>
      skill.enabled &&
      runsOnItsOwn(skill) &&
      skill.lastRun?.status === "ok" &&
      skill.lastRun.result?.tools.some((tool) => HOSPITABLE_TOOLS.includes(tool)),
  );
  const [hospitable, gmail, outlook] = await Promise.all([
    hospitableCard().catch(() => null),
    gmailConnected().catch(() => false),
    outlookConnected().catch(() => false),
  ]);
  const gmailReady = gmailKeysReady();
  const outlookReady = outlookKeysReady();
  const airroi = Boolean(process.env.AIRROI_API_KEY?.trim());
  const cursor = Boolean(process.env.CURSOR_API_KEY?.trim());
  const cleaner = cleanerWebhookReady();
  const twilio = twilioReady();
  return [
    {
      id: "gmail",
      name: "Gmail",
      detail: "Reads Sent and Primary, and drafts a reply when you ask.",
      status: gmail ? "connected" : "not_connected",
      statusLabel: gmail ? "Connected" : "Not connected",
      note: gmail
        ? "Searches Sent and Primary. Social and Promotions stay out. A reply sends only after you press Submit."
        : gmailReady
          ? "Click Connect and allow reading and sending. A reply still waits for Submit."
          : "The Gmail sign-in is not on the server yet.",
    },
    {
      id: "outlook",
      name: "Outlook",
      detail: "Reads Sent and Focused, and drafts a reply when you ask.",
      status: outlook ? "connected" : "not_connected",
      statusLabel: outlook ? "Connected" : "Not connected",
      note: outlook
        ? "Searches Sent and the Focused inbox. Other stays out. A reply sends only after you press Submit."
        : outlookReady
          ? "Click Connect and sign in as the company mailbox. A reply still waits for Submit."
          : "The Outlook sign-in is not on the server yet.",
    },
    {
      id: "hospitable",
      name: "Hospitable",
      detail: "Lets Copilot read your stays in Hospitable. It never changes anything there.",
      status: hospitable?.connected ? "connected" : "not_connected",
      statusLabel: hospitable?.connected
        ? hospitable.choiceSaved
          ? `Connected · ${hospitable.chosenCount} in Copilot`
          : `Connected${(hospitable.properties?.length ?? 0) ? ` · ${hospitable.properties.length} ${hospitable.properties.length === 1 ? "property" : "properties"}` : ""}`
        : "Not connected",
      setup: hospitable?.connected ? "pat" : "none",
      note: hospitable?.connected
        ? readsGuests
          ? "Reservations, guest messages, and the Knowledge Hub. A reply waits until you press Submit in Guest messaging."
          : "Reservations, guest messages, and the Knowledge Hub. Nothing in Hospitable changes from here."
        : "Hospitable is not connected.",
    },
    {
      id: "cleaner",
      name: "Cleaner app",
      detail: "Calendar, assignments, issues, inventory.",
      status: cleaner ? "connected" : "not_connected",
      statusLabel: cleaner ? "Connected" : "Not connected",
      note: cleaner
        ? "Pings Copilot when a clean is done."
        : "Turnovers still open tasks in OPS. A live calendar read is next.",
    },
    {
      id: "twilio",
      name: "Twilio",
      detail: "Texts the numbers you set.",
      status: twilio ? "connected" : "not_connected",
      statusLabel: twilio ? "Connected" : "Not connected",
      note: twilio ? "It texts you. It does not text guests." : "Twilio keys are not set on the server.",
    },
    {
      id: "airroi",
      name: "AirROI",
      detail: "Comps.",
      status: airroi ? "connected" : "not_connected",
      statusLabel: airroi ? "Connected" : "Not connected",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      detail: "Host groups only.",
      status: "not_connected",
      statusLabel: "Not connected",
    },
    {
      id: "browser",
      name: "Browser",
      detail: "Looks things up on the web when you ask.",
      status: process.env.BROWSERBASE_API_KEY?.trim() ? "connected" : "not_connected",
      statusLabel: process.env.BROWSERBASE_API_KEY?.trim() ? "On" : "Not connected",
      note: process.env.BROWSERBASE_API_KEY?.trim() ? "A lookup stays in chat until you watch, pause, or end it." : "Browser is not connected.",
    },
    {
      id: "ops",
      name: "OPS",
      detail: "Property records and the operations tools in this app.",
      status: "connected",
      statusLabel: "On",
      note: "Copilot reads OPS here. It does not use the Hospitable token stored for Copilot.",
    },
    {
      id: "cursor",
      name: "Cursor",
      detail: "Team keys.",
      status: cursor ? "connected" : "not_connected",
      statusLabel: cursor ? "Team keys are set" : "Not connected",
      note: cursor ? "Saved skill runs can use the team key. This chat does not." : "The team key is not set on the server.",
    },
  ];
}

async function factsFor(): Promise<string> {
  const [brief, rows, skills, memory, memoryFiles] = await Promise.all([
    readStoredBrief().catch(() => null),
    connectors(),
    skillRows().catch(() => [] as SkillRow[]),
    listMemory().catch(() => []),
    listMemoryFiles().catch(() => []),
  ]);
  const lines: string[] = [];
  if (brief) {
    lines.push(`${brief.hello} ${brief.line}`.trim());
    const cards = [...brief.focus, ...brief.eating];
    if (!cards.length) lines.push("No brief cards right now.");
    for (const card of cards) lines.push(`Card: ${card.text}`);
  }
  for (const row of rows) lines.push(`${row.name}: ${row.statusLabel}. ${row.detail} ${row.note ?? ""}`.trim());
  if (!skills.length) lines.push("No saved skills.");
  for (const skill of skills) {
    lines.push(
      `Skill ${skill.name} (${skill.enabled ? "on" : "off"}, ${skill.kind}, ${runsOnItsOwn(skill) ? schedulePhrase(skill.schedule) : "runs only when asked"}, last run ${skill.lastRun ? skill.lastRun.status : "never"}): when ${skill.when_text}. Reads ${skill.reads}. Writes ${skill.drafts}. Must not ${skill.must_not}. Phone ${skill.phone || "none"}.`,
    );
  }
  for (const note of memory) lines.push(`Remembered: ${note}`);
  lines.push(...promptLines(memoryFiles));
  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) return unauthorized(res);

  let sendChatId = "";
  let sendText = "";
  try {
    if (req.method === "GET") {
      const op = String(req.query.op ?? "boot");
      if (op === "messages") {
        const chatId = String(req.query.chatId ?? "");
        return res.status(200).json({ messages: await listMessages(chatId, { lookup: false }) });
      }
      if (op === "guests-refresh" || op === "guests-queue") {
        return res.status(200).json(await loadGuestQueue());
      }
      const [cursorRuns, browserRuns] = await Promise.all([
        listCursorRuns().catch(() => []),
        listOpenBrowsers().catch(() => []),
      ]);
      const runningChatIds = [...new Set([...cursorRuns.map((row) => row.chatId), ...browserRuns.map((row) => row.chatId)])];
      const skills = await skillRows().catch(() => [] as Awaited<ReturnType<typeof skillRows>>);
      const [brief, chats, memory, textLog, textNumbers, memoryFiles, connectorRows, guestQueue, hospitable] = await Promise.all([
        readStoredBrief().catch(() => quietBrief()),
        listChats().catch(() => []),
        listMemory().catch(() => []),
        listTextLog().catch(() => []),
        listTextNumbers().catch(() => []),
        listStoredMemoryFiles().catch(() => []),
        connectors(skills).catch(() => [] as ConnectorRow[]),
        readSavedGuestQueue().catch(() => null),
        hospitableCard().catch(() => null),
      ]);
      return res.status(200).json({
        brief,
        guestQueue,
        chats,
        skills,
        textLog,
        textNumbers,
        twilioFrom: twilioFromLabel(),
        memory,
        memoryFiles,
        connectors: connectorRows,
        hospitable,
        runningChatIds,
        billing: process.env.CURSOR_API_KEY
          ? "Cursor Auto is connected. The team spend total appears when the admin key is set."
          : "Cursor isn’t connected yet. The brief still uses your records. Nothing is sent.",
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
    const body = (typeof req.body === "object" && req.body ? req.body : {}) as Record<string, unknown>;
    const op = String(body.op ?? "");

    if (op === "seen") {
      const chatId = String(body.chatId ?? "").trim();
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      await markChatSeen(chatId);
      return res.status(200).json({ chats: await listChats(), brief: await readStoredBrief() });
    }

    if (op === "run-skill") {
      const id = String(body.id ?? "").trim();
      if (!id) return res.status(400).json({ error: "Missing skill." });
      const run = await startSkillRun(id, "manual");
      const skills = await skillRows();
      return res.status(200).json({ run, skills, connectors: await connectors(skills), chats: await listChats() });
    }

    if (op === "guests-queue") {
      return res.status(200).json(await readSavedGuestQueue());
    }

    if (op === "guests-refresh") {
      return res.status(200).json(await loadGuestQueue());
    }

    if (op === "guests-open") {
      const lane = body.lane === "guest" || body.lane === "none" ? body.lane : "reply";
      const row = await openGuestAnswer({
        id: String(body.id ?? ""),
        guest: String(body.guest ?? ""),
        first: String(body.first ?? ""),
        initials: String(body.initials ?? ""),
        guestPhoto: String(body.guestPhoto ?? ""),
        property: String(body.property ?? ""),
        propertyId: String(body.propertyId ?? ""),
        propertyPhoto: String(body.propertyPhoto ?? ""),
        asked: String(body.asked ?? ""),
        askedEn: String(body.askedEn ?? ""),
        language: String(body.language ?? ""),
        wait: String(body.wait ?? ""),
        waitedMs: Number(body.waitedMs ?? 0),
        thanks: Boolean(body.thanks),
        lane,
        status: String(body.status ?? ""),
        statusLead: String(body.statusLead ?? ""),
        statusRest: String(body.statusRest ?? ""),
        watch: String(body.watch ?? ""),
        when: String(body.when ?? ""),
        urgent: Boolean(body.urgent),
        dates: String(body.dates ?? ""),
        checkIn: String(body.checkIn ?? ""),
        checkOut: String(body.checkOut ?? ""),
        mediaLabel: String(body.mediaLabel ?? ""),
        lastNote: String(body.lastNote ?? ""),
      });
      return res.status(200).json(row);
    }

    if (op === "guests-submit") {
      try {
        const files = Array.isArray(body.attachments) ? body.attachments.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const file = item as { name?: unknown; mime?: unknown; data?: unknown };
          const data = String(file.data ?? "");
          if (!data) return [];
          return [{ name: String(file.name ?? "file"), mime: String(file.mime ?? "application/octet-stream"), data }];
        }) : [];
        const result = await submitGuestReply({
          reservationId: String(body.id ?? ""),
          propertyId: String(body.propertyId ?? ""),
          property: String(body.property ?? ""),
          guest: String(body.guest ?? ""),
          english: String(body.english ?? ""),
          language: String(body.language ?? ""),
          fact: String(body.fact ?? ""),
          attachments: files,
        });
        return res.status(200).json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't reach Hospitable. Nothing was sent.";
        if (/not connected/i.test(message)) return res.status(400).json({ error: "Hospitable is not connected. Nothing was sent." });
        if (/nothing was sent/i.test(message)) return res.status(400).json({ error: message });
        return res.status(400).json({ error: "Couldn't reach Hospitable. Nothing was sent." });
      }
    }

    if (op === "guests-hold") {
      holdGuestThread(String(body.id ?? ""));
      return res.status(200).json({ held: true });
    }

    if (op === "guests-handle") {
      const id = String(body.id ?? "").trim();
      if (!id) return res.status(400).json({ error: "Missing follow-up." });
      return res.status(200).json(await markFollowUpHandled(id));
    }

    if (op === "guests-inquiry") {
      const id = String(body.id ?? "").trim();
      const action = body.action === "decline" ? "decline" : "approve";
      if (!id) return res.status(400).json({ error: "Missing follow-up." });
      return res.status(200).json(await beginInquiryVerify(id, action));
    }

    if (op === "guests-stand") {
      saveStandingAnswer(String(body.situation ?? ""), String(body.wording ?? ""));
      return res.status(200).json({ saved: true });
    }

    if (op === "guests-unstand") {
      forgetStandingAnswer(String(body.situation ?? ""));
      return res.status(200).json({ saved: false });
    }

    if (op === "reviews-queue") {
      return res.status(200).json(await loadReviewQueue());
    }

    if (op === "reviews-regenerate") {
      const stars = Number(body.stars);
      const result = await regenerateFromConnection({
        guest: String(body.guest ?? ""),
        review: String(body.review ?? ""),
        current: String(body.current ?? ""),
        reservationId: String(body.reservationId ?? ""),
        propertyId: String(body.propertyId ?? ""),
        stars: Number.isFinite(stars) && stars >= 1 && stars <= 5 ? stars : undefined,
      });
      return res.status(200).json(result);
    }

    if (op === "reviews-submit") {
      try {
        await submitReviewReply(String(body.id ?? ""), String(body.text ?? ""), String(body.guest ?? "Guest"), String(body.property ?? ""), Number(body.stars ?? 0));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't reach Airbnb. Nothing posted.";
        return res.status(400).json({ error: /not connected/i.test(message) ? "Hospitable is not connected. Nothing was posted." : "Couldn't reach Airbnb. Nothing posted." });
      }
      return res.status(200).json({ posted: true });
    }

    if (op === "reviews-skip") {
      skipReview(String(body.id ?? ""));
      return res.status(200).json({ skipped: true });
    }

    if (op === "reviews-undo") {
      undoSkip(String(body.id ?? ""));
      return res.status(200).json({ skipped: false });
    }

    if (op === "hospitable-connection") {
      if (body.action === "open") {
        const card = await hospitablePage();
        return res.status(200).json({ hospitable: card, connectors: await connectors() });
      }
      if (body.action === "disconnect") {
        const card = await disconnectHospitable();
        return res.status(200).json({ hospitable: card, connectors: await connectors() });
      }
      if (body.action === "select") {
        try {
          const ids = Array.isArray(body.propertyIds) ? body.propertyIds.map(String) : [];
          const card = await saveHospitableSelection(ids);
          return res.status(200).json({ hospitable: card, connectors: await connectors() });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Hospitable is not connected.";
          return res.status(400).json({ error: message });
        }
      }
      const saved = await saveHospitableToken(String(body.token ?? ""));
      if (saved.error) return res.status(400).json({ error: saved.error, hospitable: saved.card });
      return res.status(200).json({ hospitable: saved.card, connectors: await connectors() });
    }

    if (op === "hospitable-mcp") {
      if (body.action === "clear") {
        try {
          await updatePmSettings({ hospitable_mcp_token: "" });
        } catch (err) {
          return res.status(400).json({ error: mcpSaveError(err) });
        }
        return res.status(200).json({ connectors: await connectors() });
      }
      const token = cleanMcpToken(String(body.token ?? ""));
      if (!token) return res.status(400).json({ error: "Paste the MCP fallback token." });
      try {
        await verifyHospitableMcpToken(token);
        await updatePmSettings({ hospitable_mcp_token: token });
      } catch (err) {
        return res.status(400).json({ error: mcpSaveError(err) });
      }
      return res.status(200).json({ connectors: await connectors() });
    }

    if (op === "memory-file") {
      const action = String(body.action ?? "");
      const filePath = String(body.path ?? "").trim();
      if (action !== "delete" || !filePath) return res.status(400).json({ error: "Missing file." });
      const memoryFiles = await deleteMemoryFile(filePath);
      return res.status(200).json({ memoryFiles });
    }

    if (op === "rank-pass") {
      const cardId = String(body.cardId ?? "").trim();
      if (!cardId) return res.status(400).json({ error: "Missing card." });
      return res.status(200).json({ brief: await noteRankPass(cardId) });
    }

    if (op === "refresh-brief") {
      return res.status(200).json({ brief: await refreshSavedBrief() });
    }

    if (op === "dismiss") {
      const cardId = String(body.cardId ?? "").trim();
      if (!cardId) return res.status(400).json({ error: "Missing card." });
      return res.status(200).json({ brief: await dismissSavedCard(cardId) });
    }

    if (op === "open-item") {
      const cardId = String(body.cardId ?? "").trim();
      const label = String(body.choice ?? "").trim();
      const brief = await applyOpenItemOnBrief(cardId, label);
      if (!brief) return res.status(400).json({ error: "Missing choice." });
      return res.status(200).json({ brief });
    }

    if (op === "new") {
      const kind = body.kind === "code" ? "code" : "chat";
      const chat = await createChat(kind === "code" ? "Code" : "New chat", kind);
      return res.status(200).json({ chat, messages: [] });
    }

    if (op === "card") {
      const text = String(body.text ?? "").trim();
      if (!text) return res.status(400).json({ error: "Missing card." });
      const chat = await createChat(await nameChat(text));
      await addMessage({ chatId: chat.id, role: "user", body: text });
      if (/Want me to reply\?/i.test(text)) {
        const result = await mailDraftFromOffer(text);
        await addMessage({
          chatId: chat.id,
          role: "assistant",
          body: result.body,
          draft: result.draft ? { ...result.draft, status: "waiting", channel: "email" } : null,
          steps: [{ text: result.draft ? "Wrote a reply" : "Couldn't write a reply" }],
          thought: "Nothing was sent. Submit is what sends it.",
        });
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      if (/Already upgraded/.test(text) && /Still pending/.test(text)) {
        await addMessage({
          chatId: chat.id,
          role: "assistant",
          body: text,
          choices: ["Already upgraded", "Still pending"],
          thought: "Nothing was sent.",
        });
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      const pinned = await pinnedCompanyAnswer(text);
      if (pinned) {
        await addMessage({
          chatId: chat.id,
          role: "assistant",
          body: pinned.body,
          property: pinned.property,
          steps: [{ text: pinned.step }],
          thought: pinned.thought,
        });
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      if (ASKS_HOSPITABLE.test(text) && (await hospitableMessage(chat.id, "auto", text, []))) {
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      const result = draftForCard(text, String(body.action ?? ""));
      await addMessage({
        chatId: chat.id,
        role: "assistant",
        body: result.body,
        draft: result.draft,
        choices: result.choices ?? null,
        steps: [{ text: "Wrote a note" }],
        thought: "Nothing was sent.",
      });
      return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
    }

    if (op === "watch-browser") {
      const chatId = String(body.chatId ?? "");
      const goal = String(body.goal ?? "Watch").trim() || "Watch";
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      try {
        const opened = await startBrowser(chatId, goal);
        const session = beginSession({
          chatId,
          goal,
          askedBy: "Watch",
          liveUrl: opened.view?.liveUrl || "",
        });
        return res.status(200).json({
          chatId,
          session,
          view: opened.view,
          messages: await listMessages(chatId),
          pending: opened.pending,
        });
      } catch (err) {
        return res.status(200).json({ chatId, error: publicError(err) });
      }
    }

    if (op === "end-browser") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const pages = sessionPages(body.pages);
      if (!pages.length) {
        const existing = await listMessages(chatId);
        const already = [...existing].reverse().find((message) => message.role === "assistant");
        if (already?.body !== PAGE_UNREAD) {
          await addMessage({
            chatId,
            role: "assistant",
            body: PAGE_UNREAD,
            thought: PAGE_UNREAD,
          });
        }
        await releaseBrowser(chatId).catch(() => undefined);
        return res.status(200).json({
          chatId,
          messages: await listMessages(chatId),
          chats: await listChats(),
        });
      }
      let session = beginSession({ chatId, goal: String(body.goal ?? ""), askedBy: "Chat" });
      for (const page of pages) session = readPage(session, page);
      const ended = await publishFindings(session, async (entry) => {
        await addMessage({
          chatId: entry.chatId,
          role: "assistant",
          body: entry.body,
          thought: "This came from the browser session. Nothing was sent.",
        });
      });
      await releaseBrowser(chatId).catch(() => undefined);
      return res.status(200).json({
        chatId,
        messages: await listMessages(chatId),
        chats: await listChats(),
        body: ended.body,
      });
    }

    if (op === "think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const browser = await collectBrowser(chatId, body.hold === true);
      if (browser) {
        return res.status(200).json({
          chatId,
          messages: await listMessages(chatId),
          pending: browser.pending,
          steps: browser.steps,
          thought: browser.thought,
          view: browser.view,
          chats: browser.pending ? undefined : await listChats(),
        });
      }
      const state = await collectCursorRun(chatId, true);
      const stamp = state.view?.image ? `${state.view.image.length}:${state.view.image.slice(0, 16)}:${state.view.image.slice(-16)}` : "";
      const sameFrame = Boolean(stamp) && stamp === String(body.viewRev ?? "");
      const view = state.view
        ? {
            url: state.view.url,
            pointer: state.view.pointer,
            ...(stamp ? { rev: stamp } : {}),
            ...(state.view.image && !sameFrame ? { image: state.view.image, mime: state.view.mime } : {}),
          }
        : undefined;
      return res.status(200).json({
        chatId,
        messages: await listMessages(chatId),
        pending: state.pending,
        steps: state.steps,
        thought: state.thought,
        view,
        chats: state.pending ? undefined : await listChats(),
      });
    }

    if (op === "accounts") {
      return res.status(200).json({ accounts: await accountSpend() });
    }

    if (op === "cancel-think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const stoppedBrowser = await cancelBrowser(chatId);
      if (!stoppedBrowser) await cancelCursorRun(chatId);
      return res.status(200).json({ chatId, messages: await listMessages(chatId), pending: false });
    }

    if (op === "send") {
      const images = readImages(body.images);
      const text = String(body.text ?? "").trim() || (images.length ? "Look at the attached photo." : "");
      const kind = body.kind === "code" ? "code" : "chat";
      if (!text) return res.status(400).json({ error: "Write a message first." });
      sendText = text;
      let chatId = String(body.chatId ?? "");
      if (!chatId) {
        const chat = await createChat(await nameChat(text), kind);
        chatId = chat.id;
      }
      sendChatId = chatId;
      if (chatId && /^(please\s+)?(stop|stop running|stop the browser|stop it|cancel)(\s+running)?[.!]*$/i.test(text) && (await browserIsLive(chatId))) {
        await addMessage({ chatId, role: "user", body: text });
        await cancelBrowser(chatId);
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending: false });
      }
      const pictureMode = body.pictureMode === true;
      const skillMode = body.skillMode === true;
      const webSearch = !skipsWeb(text) && (body.webSearch === true || wantsWeb(text));
      const pictureChoice = pictureFor(text, images.length > 0);
      const userMessage = await addMessage({ chatId, role: "user", body: text, images, picture: pictureMode });
      const signIn = await answerSignIn(chatId);
      if (signIn) {
        await addMessage({
          chatId,
          role: "assistant",
          body: signIn.body,
          choices: signIn.choices,
          steps: signIn.steps,
          thought: signIn.thought,
        });
        let pending = false;
        let view: { url: string; liveUrl: string } | undefined;
        let steps: { text: string }[] | undefined;
        let thought: string | undefined;
        if (signIn.continueWeb) {
          try {
            const opened = await resumeBrowser(chatId);
            pending = opened.pending;
            view = opened.view;
            steps = opened.steps;
            thought = opened.thought;
          } catch (err) {
            await addMessage({
              chatId,
              role: "assistant",
              body: publicError(err),
            });
          }
        }
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending, view, steps, thought });
      }
      let pending = false;
      const done = async () => {
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending });
      };
      const clock = parityNow() ?? new Date();
      const corrected = takeCorrection(text);
      if (corrected && !pictureMode && !skillMode) {
        const items = await listOpenItems();
        for (const item of items) {
          if (item.status !== "open") continue;
          const next = applyCorrections(item.text);
          if (next !== item.text) await saveStoredOpenItem({ ...item, text: next });
        }
        await addMessage({
          chatId,
          role: "assistant",
          body: corrected,
          steps: [{ text: "Corrected the stored record" }],
          thought: "The correction is stored. Later answers use it.",
        });
        return done();
      }
      if (asksMailBreakdown(text)) {
        const narrative = await answerMailChain(text);
        await addMessage({
          chatId,
          role: "assistant",
          body: narrative ?? "I didn't find that email chain. I didn't guess.",
          steps: [{ text: /didn't find|isn't connected|didn't return/i.test(narrative ?? "") ? "The mail read failed" : "Read the email chain" }],
          thought: "This came from the mailbox. Nothing was sent.",
        });
        return done();
      }
      if (asksClientList(text)) {
        const stored = await answerOwnStore(text);
        await addMessage({
          chatId,
          role: "assistant",
          body: stored?.body ?? CLIENT_STORE_EMPTY,
          steps: [{ text: stored?.step ?? "The client list failed" }],
          thought: stored?.thought ?? "OPS didn't return the clients. Nothing was sent.",
        });
        return done();
      }
      const choice = openItemChoice(text);
      if (choice && !pictureMode && !skillMode) {
        const open = (await listOpenItems()).filter((item) => item.status === "open");
        const target = open.length === 1 ? open[0] : null;
        if (target) {
          await chooseOpenItem(target.id, choice);
          await addMessage({
            chatId,
            role: "assistant",
            body: choice === "closed" ? "Closed. It will not come back." : "Still open. I didn't add a reminder.",
            thought: "Nothing was sent.",
          });
          return done();
        }
      }
      if (pictureMode) {
        if (pictureChoice.needsPhoto && !images.length) {
          await addMessage({
            chatId,
            role: "assistant",
            body: "Add a photo first. Draft makes a new picture and will not keep a face. Nothing was generated.",
          });
        } else {
          const image = await makePicture(text, {
            quality: pictureChoice.quality,
            images: pictureChoice.needsPhoto ? images : [],
          });
          await addMessage(
            image
              ? { chatId, role: "assistant", body: text, images: [image], picture: true }
              : { chatId, role: "assistant", body: "The picture didn’t come back. Nothing was saved." },
          );
        }
        return done();
      }
      if (!pictureMode && !skillMode) {
        const history = await listMessages(chatId);
        const earlier = history.slice(0, -1);
        let priorBody = "";
        let carriedProperty: PropertyIdentity | null = null;
        for (let i = earlier.length - 1; i >= 0; i -= 1) {
          if (earlier[i]?.role === "assistant") {
            priorBody = earlier[i]?.body ?? "";
            carriedProperty = earlier[i]?.property ?? null;
            break;
          }
        }
        const payout = await answerPayout(text, priorBody, clock, carriedProperty);
        if (payout) {
          await addMessage({
            chatId,
            role: "assistant",
            body: payout.body,
            property: payout.property ?? carriedProperty,
            steps: [{ text: payout.step }],
            thought: "This came from the property's saved payout terms and the reservation records. Nothing was searched on the web.",
          });
          return done();
        }
        const propertyReport = await answerPropertyReport(text, priorBody, clock);
        if (propertyReport) {
          await addMessage({
            chatId,
            role: "assistant",
            body: propertyReport.body,
            file: propertyReport.file,
            steps: [{ text: propertyReport.file ? "Made the PDF" : "Did not make a PDF" }],
            thought: propertyReport.thought,
          });
          return done();
        }
      }
      if (!pictureMode) {
        const pinnedHistory = await listMessages(chatId);
        let pinnedPrior = "";
        let pinnedCarried: StayCard[] = [];
        let pinnedProperty: PropertyIdentity | null = null;
        for (let i = pinnedHistory.length - 1; i >= 0; i -= 1) {
          if (pinnedHistory[i]?.role === "assistant") {
            pinnedPrior = pinnedHistory[i]?.body ?? "";
            pinnedCarried = pinnedHistory[i]?.stayRows ?? [];
            pinnedProperty = pinnedHistory[i]?.property ?? null;
            break;
          }
        }
        const pinned = await pinnedCompanyAnswer(text, { prior: pinnedPrior, carried: pinnedCarried, property: pinnedProperty });
        if (pinned) {
          await addMessage({
            chatId,
            role: "assistant",
            body: pinned.body,
            property: pinned.property ?? pinnedProperty,
            steps: [{ text: pinned.step }],
            thought: pinned.thought,
          });
          return done();
        }
      }
      if (!pictureMode && !skillMode) {
        const history = await listMessages(chatId);
        const earlier = history.slice(0, -1);
        const prior = [
          ...earlier.filter((message) => message.role === "assistant"),
          ...earlier.filter((message) => message.role === "user"),
        ].map((message) => message.body).join("\n");
        const guestStay = await answerGuestStay(text, prior);
        if (guestStay) {
          const missingPay = /not its payment figures/.test(guestStay);
          await addMessage({
            chatId,
            role: "assistant",
            body: guestStay,
            steps: [{ text: missingPay ? "The payment figures were not on the reservation" : "Read the reservation" }],
            thought: missingPay
              ? "The reservation is in Hospitable. Its payment figures were not. Nothing was searched."
              : "This came from the reservation in Hospitable. Nothing was searched.",
          });
          return done();
        }
      }
      if (!pictureMode && !skillMode && !skipsWeb(text) && (asksFetchLookup(text) || asksWebLookup(text))) {
        const said = asksFetchLookup(text) ? await runFetchLookup(text, () => answerWebLookup(text)) : await answerWebLookup(text);
        await addMessage({
          chatId,
          role: "assistant",
          body: said,
          steps: [{ text: /that read failed/i.test(said) ? "That read failed" : "Opened the page" }],
          thought: asksFetchLookup(text) ? "This came from the page. No browser session was started." : "This came from the page. Nothing was purchased.",
        });
        return done();
      }
      if (!pictureMode && !skillMode) {
        try {
          const history = await listMessages(chatId);
          const previous = history[history.length - 2];
          const before = history[history.length - 3];
          const linked = (await connectors()).filter((row) => row.status === "connected").map((row) => row.id);
          const memoryTurn = await takeMemoryTurn({
            text,
            messageId: userMessage.id,
            chatId,
            priorAssistant: previous?.role === "assistant" ? previous.body : "",
            priorUser: before?.role === "user" ? before.body : "",
            connected: linked,
          });
          if (memoryTurn) {
            await addMessage({
              chatId,
              role: "assistant",
              body: memoryTurn.body,
              choices: memoryTurn.choices ?? null,
              steps: [{ text: memoryTurn.step }],
              thought: memoryTurn.thought,
              memoryFile: memoryTurn.file,
            });
            const messages = await listMessages(chatId);
            const chats = await listChats();
            const memoryFiles = await listMemoryFiles().catch(() => []);
            return res.status(200).json({ chatId, messages, chats, pending: false, memoryFiles });
          }
        } catch (err) {
          const raw = err instanceof Error ? err.message : "The file was not written.";
          await addMessage({
            chatId,
            role: "assistant",
            body: isFilesystemError(err) ? (asksPropertyReport(text) ? REPORT_FILE_FAILURE : "That could not be saved.") : raw,
            thought: "Nothing was sent.",
          });
          return done();
        }
      }
      if (!webSearch && !skillMode) {
        const history = await listMessages(chatId);
        let prior = "";
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === "assistant") {
            prior = history[i]?.body ?? "";
            break;
          }
        }
        if (declinesReply(text, prior)) {
          await addMessage({ chatId, role: "assistant", body: "Held. Nothing was sent.", thought: "Nothing was sent." });
          return done();
        }
        if (agreesToReply(text, prior) || /wrote about .+\. Want me to reply\?/i.test(text)) {
          const result = await mailDraftFromOffer(text);
          await addMessage({
            chatId,
            role: "assistant",
            body: result.body,
            draft: result.draft ? { ...result.draft, status: "waiting", channel: "email" } : null,
            steps: [{ text: result.draft ? "Wrote a reply" : "Couldn't write a reply" }],
            thought: "Nothing was sent. Submit is what sends it.",
          });
          return done();
        }
      }
      if (!webSearch && !skillMode) {
        const history = await listMessages(chatId);
        let prior = "";
        let carried: StayCard[] = [];
        let carriedProperty: PropertyIdentity | null = null;
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === "assistant") {
            prior = history[i]?.body ?? "";
            carried = history[i]?.stayRows ?? [];
            carriedProperty = history[i]?.property ?? null;
            break;
          }
        }
        const gap = missingSourceAnswer(text);
        if (gap) {
          await addMessage({
            chatId,
            role: "assistant",
            body: gap,
            steps: [{ text: "That source is not connected" }],
            thought: "No connected source holds that. Nothing was guessed.",
          });
          return done();
        }
        const stored = await answerOwnStore(text);
        if (stored) {
          await addMessage({
            chatId,
            role: "assistant",
            body: stored.body,
            steps: [{ text: stored.step }],
            thought: stored.thought,
          });
          return done();
        }
        const pdfReport = await answerPdfReport(text);
        if (pdfReport) {
          await addMessage({
            chatId,
            role: "assistant",
            body: pdfReport.body,
            file: pdfReport.file,
            steps: [{ text: pdfReport.file ? "Made the PDF" : "Did not make a PDF" }],
            thought: pdfReport.file ? "The PDF uses the same OPS figures as this answer. Nothing was sent." : "That report was not made. Nothing was substituted.",
          });
          return done();
        }
        const opsAnswer = await answerOps(text, new Date(), prior);
        if (opsAnswer) {
          await addMessage({
            chatId,
            role: "assistant",
            body: opsAnswer,
            steps: [{ text: "Read OPS" }],
            thought: "This came from OPS. Nothing was sent.",
          });
          return done();
        }
        if (asksContractRevision(text)) {
          const prepared = await prepareContractAmendment(text);
          await addMessage({
            chatId,
            role: "assistant",
            body: prepared.body,
            draft: prepared.draft,
            steps: [{ text: prepared.draft ? "Prepared the updated contract" : "Did not prepare a send" }],
            thought: "Nothing was sent.",
          });
          return done();
        }
        if (asksSop(text)) {
          const shaped = sopFromWords(text);
          const saved = shaped ? await createOpsSop(shaped) : "An SOP needs a title and the steps. Nothing was saved.";
          const sopFailed = /creation failed|nothing was saved|needs a title|needs the steps/i.test(saved);
          await addMessage({
            chatId,
            role: "assistant",
            body: saved,
            steps: [{ text: sopFailed ? "The SOP was not created" : "Saved the SOP" }],
            thought: sopFailed ? "The creation failed." : "This is in OPS.",
          });
          return done();
        }
        if (asksProposalSend(text)) {
          const prepared = await prepareProposalSend();
          await addMessage({
            chatId,
            role: "assistant",
            body: prepared.body,
            draft: prepared.draft,
            steps: [{ text: prepared.draft ? "Prepared the proposal email" : "Did not prepare a send" }],
            thought: "Nothing was sent.",
          });
          return done();
        }
        if (asksProposalEdit(text)) {
          const edited = await editProposal(text);
          await addMessage({
            chatId,
            role: "assistant",
            body: edited.body,
            steps: [{ text: edited.proposal && edited.regenerated.length ? "Saved a new proposal version" : "Did not change the proposal" }],
            thought: "Nothing was sent.",
          });
          return done();
        }
        if (asksProposal(text)) {
          const prepared = await proposalFromWords(text, images);
          await addMessage({
            chatId,
            role: "assistant",
            body: prepared.body,
            steps: [{ text: prepared.proposal ? "Saved the proposal" : "Did not save a proposal" }],
            thought: "Nothing was sent.",
          });
          return done();
        }
        if (asksCleanerAssignment(text)) {
          const job = cleanerFromWords(text);
          const prepared = job
            ? await prepareCleanerAssignment(job)
            : { body: "Tell me the unit, the turnover date, and who to assign. Nothing was written.", draft: null };
          await addMessage({
            chatId,
            role: "assistant",
            body: prepared.body,
            draft: prepared.draft,
            steps: [{ text: prepared.draft ? "Prepared the assignment" : "Asked who to assign" }],
            thought: "Nothing was written to the cleaner app.",
          });
          return done();
        }
        const inbox = await answerInboxToday(text);
        if (inbox) {
          await addMessage({
            chatId,
            role: "assistant",
            body: inbox,
            steps: [{ text: /isn't connected|didn't return|couldn't read/i.test(inbox) ? "The mail read failed" : "Read the inbox" }],
            thought: "This came from the mailbox. Nothing was sent.",
          });
          return done();
        }
        const outside = await answerOutsideRentals(text);
        if (outside) {
          await addMessage({
            chatId,
            role: "assistant",
            body: outside.body,
            steps: [{ text: outside.kind === "refused" ? "Left that listing alone" : /that read failed/i.test(outside.body) ? "That read failed" : "Opened the page" }],
            thought: outside.kind === "refused" ? "That listing is not one we manage. Nothing was drafted." : "This came from the page. Nothing was sent.",
          });
          return done();
        }
        const shownDrafts = await answerWaitingDrafts(text, clock);
        if (shownDrafts) {
          await addMessage({
            chatId,
            role: "assistant",
            body: shownDrafts,
            steps: [{ text: "Read the guest drafts" }],
            thought: "This is the draft in Guest messaging. Nothing was sent.",
          });
          return done();
        }
        const namedDraft = await answerNamedGuestDraft(text, clock);
        if (namedDraft) {
          const asked = /which guest|which one|couldn't read|was not saved/i.test(namedDraft);
          await addMessage({
            chatId,
            role: "assistant",
            body: namedDraft,
            steps: [{ text: asked ? "Asked which guest" : "Drafted the guest reply" }],
            thought: asked ? "Nothing was drafted." : "The draft is in Checks. Nothing is sent until Submit.",
          });
          return done();
        }
        const guestThreads = await answerGuestThreads(text, clock);
        if (guestThreads) {
          await addMessage({
            chatId,
            role: "assistant",
            body: guestThreads,
            steps: [{ text: "Read guest threads" }],
            thought: /is in Checks/.test(guestThreads)
              ? "Drafts are in Checks. Nothing is sent until Submit."
              : "Nothing new was left in Checks.",
          });
          return done();
        }
        const handled = await closeHandledAnswer(text);
        if (handled) {
          await addMessage({
            chatId,
            role: "assistant",
            body: handled,
            steps: [{ text: /could not close/.test(handled) ? "The item is still open" : "Closed the item" }],
            thought: /could not close/.test(handled) ? "The close was not read back." : "The item was read back as closed. It will not be raised again.",
          });
          return done();
        }
        const registration = (await answerRegistrationStatus(text, clock)) ?? (await answerBuildingRegistration(text));
        if (registration) {
          const already = /already sent/i.test(registration);
          await addMessage({
            chatId,
            role: "assistant",
            body: registration,
            steps: [{ text: already ? "Read the sent building email" : /didn't find|didn't draft|couldn't read|didn't return|was not saved|Nothing was drafted/i.test(registration) ? "The building email was not drafted" : "Drafted the building email" }],
            thought: already
              ? "This came from Sent mail. Nothing was drafted."
              : /is in Checks/.test(registration)
                ? "The draft is in Checks. Nothing was sent. Submit is what sends it."
                : "The building email was not saved.",
          });
          return done();
        }
        const dayPlan = await answerDayPlan(text, clock);
        if (dayPlan) {
          await addMessage({
            chatId,
            role: "assistant",
            body: dayPlan,
            steps: [{ text: /can't read today's plan/.test(dayPlan) ? "The reservation read failed" : "Read today's stays" }],
            thought: /can't read today's plan/.test(dayPlan) ? "Today's plan was not guessed." : "This is today's arrivals and departures. A cancelled reservation is not included. Nothing was sent.",
          });
          return done();
        }
        const weekCleans = await answerWeekCleans(text, clock);
        if (weekCleans) {
          await addMessage({
            chatId,
            role: "assistant",
            body: weekCleans,
            steps: [{ text: /can't read this week's cleans/.test(weekCleans) ? "The cleans read failed" : "Read this week's turnovers" }],
            thought: /can't read this week's cleans/.test(weekCleans) ? "The cleans count was not guessed." : "Each line is one turnover, a property on one date. Nothing was sent.",
          });
          return done();
        }
        const sheet = await openDaySheet(text, prior, carried);
        if (sheet) {
          await addMessage({
            chatId,
            role: "assistant",
            body: sheet.body,
            stayRows: sheet.stays,
            steps: [{ text: sheet.body === prior && carried.length ? "Used the same stays" : "Read the reservations" }],
            thought: "These are the accepted stays on the managed properties. Nothing was sent.",
          });
          return done();
        }
        const stay = await answerStayDetail(text, prior, carried, carriedProperty);
        if (stay) {
          await addMessage({
            chatId,
            role: "assistant",
            body: stay.body,
            property: stay.property,
            steps: [{ text: "Read the reservation" }],
            thought: "This came from Hospitable. Nothing was sent.",
          });
          return done();
        }
        const fact = await answerPropertyFact(text);
        if (fact) {
          const fromMemory = /from saved memory/i.test(fact) && !/saved memory differs/i.test(fact);
          await addMessage({
            chatId,
            role: "assistant",
            body: fact,
            steps: [{ text: /didn't return/.test(fact) ? "The Knowledge Hub didn't return" : fromMemory ? "Read saved memory" : "Read the Knowledge Hub" }],
            thought: fromMemory ? "This came from saved memory. Nothing was sent." : "This came from the Knowledge Hub. Nothing was sent.",
          });
          return done();
        }
        const records = await answerRecords(text, prior);
        const missed = records ? /isn't connected|didn't guess|couldn't read|isn't set up|isn't available|didn't return/i.test(records) : false;
        if (records && !missed) {
          await addMessage({
            chatId,
            role: "assistant",
            body: records,
            steps: [{ text: "Read the records" }],
            thought: records.startsWith("We manage")
              ? "This came from Units we manage."
              : "This came from Hospitable. Nothing was sent.",
          });
          return done();
        }
        if (images.length && !ASKS_HOSPITABLE.test(text) && !asksAboutMail(text)) {
          const spoken = await answerPhoto(text, images);
          const photoMissed = /couldn't read|isn't connected/i.test(spoken);
          await addMessage({
            chatId,
            role: "assistant",
            body: spoken,
            steps: [{ text: photoMissed ? "Could not read the photo" : "Looked at the photo" }],
            thought: photoMissed ? "The photo did not come back as a description." : "The photo was read here. Nothing was sent.",
          });
          return done();
        }
        if (await hospitableMessage(chatId, workModel(String(body.model ?? "auto")).id, text, images)) return done();
        if (missed && records) {
          await addMessage({
            chatId,
            role: "assistant",
            body: records,
            steps: [{ text: "Couldn't read the records" }],
            thought: "Hospitable didn't return that. Nothing was sent.",
          });
          return done();
        }
      }
      if (skillMode && !webSearch) {
        const history = await listMessages(chatId);
        const prior = history.slice(0, -1).map((message) => ({ role: message.role, body: message.body }));
        const result = skillTurn(text, prior);
        let bodyText = result.body;
        let draft = result.draft;
        const said = [...prior.map((message) => message.body), text].join("\n");
        if (draft?.channel === "skill" && draft.skillKind !== "text") {
          bodyText = await reportSkillCreation(draft, said);
          if (bodyText === CREATION_FAILED) draft = null;
        }
        const created = bodyText !== CREATION_FAILED && draft?.channel === "skill" && draft.skillKind !== "text";
        await addMessage({
          chatId,
          role: "assistant",
          body: bodyText,
          draft,
          choices: result.choices ?? null,
          steps: [{ text: created ? "Saved the skill" : draft ? "Drafted the skill" : bodyText === CREATION_FAILED ? "The skill was not created" : "Asked about the skill" }],
          thought: created ? "The skill is saved and off. Nothing was sent." : bodyText === CREATION_FAILED ? "The creation failed." : "Nothing was saved, and nothing was sent.",
        });
        return done();
      }
      if (images.length && !skillMode && !webSearch && !ASKS_HOSPITABLE.test(text)) {
        const spoken = await answerPhoto(text, images);
        const missed = /couldn't read|isn't connected/i.test(spoken);
        await addMessage({
          chatId,
          role: "assistant",
          body: spoken,
          steps: [{ text: missed ? "Could not read the photo" : "Looked at the photo" }],
          thought: missed ? "The photo did not come back as a description." : "The photo was read here. Nothing was sent.",
        });
        return done();
      }
      if (!skillMode && !webSearch) {
        const math = solveMath(text);
        const spoken = math ?? (await answerGeneral(text));
        if (spoken) {
          await addMessage({
            chatId,
            role: "assistant",
            body: spoken,
            steps: [{ text: math ? "Worked it out" : "Answered" }],
            thought: math ? "This was arithmetic, so it stayed in the app." : "This stayed in the app. Nothing was sent.",
          });
          return done();
        }
        await addMessage({
          chatId,
          role: "assistant",
          body: "I could not read that.",
          steps: [{ text: "Stayed in the app" }],
          thought: "Nothing was sent.",
        });
        return done();
      }
      if (webSearch && !needsLiveBrowser(text)) {
        const said = await answerWebLookup(text);
        await addMessage({
          chatId,
          role: "assistant",
          body: said,
          steps: [{ text: /that read failed/i.test(said) ? "That read failed" : "Opened the page" }],
          thought: "This came from the page. No browser session was started.",
        });
        return done();
      }
      if (webSearch) {
        try {
          const opened = await startBrowser(chatId, text);
          pending = opened.pending;
          const messages = await listMessages(chatId);
          const chats = await listChats();
          return res.status(200).json({
            chatId,
            messages,
            chats,
            pending,
            view: opened.view,
            steps: opened.steps,
            thought: opened.thought,
          });
        } catch (err) {
          await addMessage({ chatId, role: "assistant", body: publicError(err) });
          const messages = await listMessages(chatId);
          const chats = await listChats();
          return res.status(200).json({ chatId, messages, chats, pending: false });
        }
      }
      return done();
    }

    if (op === "draft") {
      const messageId = String(body.messageId ?? "");
      const action = String(body.action ?? "");
      const edited = String(body.edited ?? "");
      if (!messageId) return res.status(400).json({ error: "Missing draft." });
      if (action === "purchase" || action === "not-now" || action === "skip" || action === "alternative") {
        const loaded = await readMessage(messageId);
        const current = loaded ? await ensureLegacyPurchase(loaded) : loaded;
        const purchase = current?.draft?.purchase;
        const detail = purchase?.kind === "detail" ? purchase : purchase?.kind === "failed" ? purchase.detail : null;
        if (!detail) return res.status(200).json({ message: current });
        if (action === "not-now") {
          const held = holdPurchase(detail);
          const message = await updateDraft(messageId, { status: "held", purchase: held, bodyText: heldText(held) });
          return res.status(200).json({ message });
        }
        if (action === "skip") {
          const skipped = skipPurchase(detail);
          const message = await updateDraft(messageId, { status: "held", purchase: skipped, bodyText: skippedText(skipped) });
          return res.status(200).json({ message });
        }
        if (action === "alternative") {
          const rawPrice = body.priceCents;
          const next = offerAlternative(detail, {
            productName: String(body.productName ?? ""),
            retailer: String(body.retailer ?? ""),
            priceCents: rawPrice == null || rawPrice === "" ? null : Number(rawPrice),
            imageUrl: String(body.imageUrl ?? ""),
            productUrl: String(body.productUrl ?? ""),
          });
          const message = await updateDraft(messageId, {
            status: "waiting",
            purchase: next,
            bodyText: next.missing || "Here is the purchase to approve. Nothing was purchased.",
          });
          return res.status(200).json({ message });
        }
        const quantity = Number(body.quantity ?? detail.quantity);
        const boughtQty = Number.isInteger(quantity) ? quantity : detail.quantity;
        const blocked = refuseCatalogPurchase({
          propertyId: detail.propertyId,
          productName: detail.productName,
          quantity: boughtQty,
          priceCents: detail.priceCents ?? -1,
          seller: detail.retailer,
          shipTo: detail.shipTo,
        });
        if (blocked) {
          const message = await updateDraft(messageId, {
            status: "waiting",
            purchase: { kind: "failed", reason: blocked, detail },
            bodyText: blocked,
          });
          return res.status(200).json({ message });
        }
        const result = await commitPurchase(detail, boughtQty);
        if (result.kind === "ordered") {
          const message = await updateDraft(messageId, {
            status: "sent",
            purchase: result,
            bodyText: `Ordered. Confirmation ${result.confirmation}. Estimated delivery ${result.delivery}. Tracking was added to the cleaner app for ${result.item} at ${result.property}.`,
          });
          return res.status(200).json({ message });
        }
        const message = await updateDraft(messageId, {
          status: "waiting",
          purchase: result.kind === "failed" ? result : detail,
          bodyText: result.kind === "failed" ? failedText(result) : "Nothing was ordered.",
        });
        return res.status(200).json({ message });
      }
      if (action === "save-skill") {
        const kind = body.kind === "text" ? "text" : "playbook";
        const phone = kind === "text" ? toE164(String(body.phone ?? "")) : "";
        if (kind === "text" && !phone) {
          return res.status(400).json({ error: "Add your mobile number. Nothing was saved." });
        }
        const name = String(body.name ?? "New skill").slice(0, 120);
        const when = String(body.when ?? "");
        const reads = String(body.reads ?? "");
        const drafts = String(body.drafts ?? "");
        const shaped = skillFromWords(`${when}\n${name}\n${reads}\n${drafts}`);
        const existing = (await listSkills()).find((row) => row.name === name);
        const skill = await saveSkill({
          id: existing?.id,
          name,
          when_text: when || shaped.when_text,
          reads: reads || shaped.reads,
          drafts: drafts || shaped.drafts,
          must_not: String(body.mustNot ?? shaped.must_not),
          enabled: existing?.enabled ?? false,
          kind,
          phone: phone ?? "",
          schedule: kind === "playbook" ? normalizeSchedule(String(body.schedule ?? shaped.schedule), when || shaped.when_text).schedule : "",
          workflow: existing?.workflow ?? shaped.workflow,
        });
        if (phone) {
          try {
            await addTextNumber(phone);
          } catch {
            /* The skill still keeps the number if the allowlist table is not there yet. */
          }
        }
        if (!(await storedSkill(skill))) return res.status(500).json({ error: CREATION_FAILED });
        const message = await updateDraft(messageId, { status: "approved_unsent" });
        if (message?.chat_id) await renameChat(message.chat_id, skill.name);
        return res.status(200).json({ message, skill, skills: await skillRows(), textNumbers: await listTextNumbers(), chats: await listChats() });
      }
      if (action === "discard-skill") {
        const message = await updateDraft(messageId, { status: "held" });
        return res.status(200).json({ message });
      }
      if (action === "release") {
        const current = await readMessage(messageId);
        const offer = current?.draft?.upsell;
        if (!offer) return res.status(400).json({ error: "That card has no time to release." });
        const said = await releaseUpsell(offer, parityNow() ?? new Date());
        const message = await updateDraft(messageId, { status: "held", bodyText: said });
        return res.status(200).json({ message });
      }
      if (action === "hold") {
        const message = await updateDraft(messageId, {
          status: "held",
          bodyText: body.channel === "hospitable" ? "Held. Nothing was changed." : body.channel === "note" ? "Held. Nothing was sent." : undefined,
        });
        return res.status(200).json({ message });
      }
      if (action === "send") {
        const note = body.channel === "note";
        const current = await readMessage(messageId);
        const draft = current?.draft;
        if (draft?.upsell) {
          const rawPrice = Number(body.priceCents);
          const cents = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice) : draft.upsell.priceCents;
          try {
            const said = await approveUpsell(draft.upsell, cents, parityNow() ?? new Date());
            const message = await updateDraft(messageId, {
              status: "sent",
              upsell: { ...draft.upsell, priceCents: cents, message: said },
              bodyText: said,
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              bodyText: err instanceof Error ? `${err.message} Nothing was sent.` : "Nothing was sent.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.proposalSend?.proposalId) {
          try {
            const said = await commitProposalSend(draft.proposalSend.proposalId);
            const message = await updateDraft(messageId, {
              status: /was sent on/.test(said) ? "sent" : "waiting",
              bodyText: said,
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              bodyText: err instanceof Error ? `${err.message} Nothing was sent.` : "Nothing was sent.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.contractSend?.contractId) {
          try {
            const said = await commitContractResend(draft.contractSend.contractId);
            const message = await updateDraft(messageId, { status: "sent", bodyText: said });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              bodyText: err instanceof Error ? `${err.message} Nothing was sent.` : "Nothing was sent.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.cleanerAssign) {
          try {
            const said = await commitCleanerAssignment(draft.cleanerAssign);
            const wrote = /Assigned /.test(said);
            const message = await updateDraft(messageId, {
              status: wrote ? "sent" : "waiting",
              bodyText: said,
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              bodyText: err instanceof Error ? `${err.message} Nothing was written.` : "Nothing was written.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.channel === "hospitable" && draft.hospitable?.tool) {
          try {
            const args = applyHospitableEdit(draft.hospitable.args, draft.body, edited || draft.body);
            await commitHospitable(draft.hospitable.tool, args);
            const message = await updateDraft(messageId, {
              status: "sent",
              body: edited || undefined,
              hospitable: { tool: draft.hospitable.tool, args },
              bodyText: "Done. It is in Hospitable.",
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              body: edited || undefined,
              bodyText: err instanceof Error ? `${err.message} Nothing was changed.` : "Nothing was changed.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.channel === "hospitable") {
          const message = await updateDraft(messageId, {
            status: "waiting",
            bodyText: "That draft has no Hospitable change to commit. Nothing was changed.",
          });
          return res.status(200).json({ message });
        }
        if (!note && draft?.channel === "email" && draft.to) {
          try {
            await deliverReply({
              to: draft.to,
              subject: draft.subject,
              body: edited || draft.body,
              threadId: draft.threadId,
              rfcId: draft.replyMessageId,
              mailbox: draft.mailbox,
            });
            const proof = await proveOutgoingMail({
              subject: draft.subject,
              body: edited || draft.body,
              to: draft.to,
            });
            const message = await updateDraft(messageId, {
              status: proof.sent ? "sent" : "waiting",
              body: edited || undefined,
              bodyText: proof.text,
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "approved_unsent",
              body: edited || undefined,
              bodyText: err instanceof Error ? err.message : "The mailbox didn't send it. Nothing went out.",
            });
            return res.status(200).json({ message });
          }
        }
        const message = await updateDraft(messageId, {
          status: "approved_unsent",
          body: edited || undefined,
          bodyText: note ? "Kept. Nothing was sent." : undefined,
        });
        return res.status(200).json({ message });
      }
      return res.status(400).json({ error: "Unknown action." });
    }

    if (op === "workflow-test") {
      const wf = body.workflow as Workflow;
      if (!wf || !Array.isArray(wf.nodes)) return res.status(400).json({ error: "Missing workflow." });
      const results = await testWorkflow(wf);
      return res.status(200).json({ results });
    }

    if (op === "workflow") {
      const wf = body.workflow as Workflow;
      if (!wf || !Array.isArray(wf.nodes)) return res.status(400).json({ error: "Missing workflow." });
      if (!wf.nodes.length) return res.status(400).json({ error: "Add a step first. Nothing was saved." });
      if (wf.on && missingNumber(wf)) return res.status(400).json({ error: "Add a number first. Nothing was turned on." });
      const shaped = skillFromWorkflow(wf);
      const phone = shaped.phone ? toE164(shaped.phone) ?? "" : "";
      if (shaped.phone.trim() && !phone) return res.status(400).json({ error: "That mobile number is not valid." });
      const existing = (await listSkills()).find((row) => row.name === shaped.name)
        ?? (wf.id && wf.id !== "new" ? (await listSkills()).find((row) => row.workflow?.id === wf.id) : undefined);
      const on = existing ? Boolean(wf.on) : false;
      const skill = await saveSkill({
        ...shaped,
        id: existing?.id,
        phone,
        enabled: on,
        workflow: shaped.workflow ? { ...shaped.workflow, on } : null,
      });
      if (phone) {
        try {
          await addTextNumber(phone);
        } catch {
          /* The skill still keeps the number if the allowlist table is not there yet. */
        }
      }
      if (!(await storedSkill(skill))) return res.status(500).json({ error: CREATION_FAILED });
      return res.status(200).json({ skill, skills: await skillRows() });
    }

    if (op === "skill") {
      if (body.action === "delete") {
        await deleteSkill(String(body.id ?? ""));
        return res.status(200).json({ skills: await skillRows() });
      }
      const kind = body.kind === "text" ? "text" : "playbook";
      const rawPhone = String(body.phone ?? "").trim();
      const phone = rawPhone ? toE164(rawPhone) : "";
      if (kind === "text" && rawPhone && !phone) {
        return res.status(400).json({ error: "That mobile number is not valid." });
      }
      const skill = await saveSkill({
        id: body.id ? String(body.id) : undefined,
        name: String(body.name ?? "New skill"),
        when_text: String(body.when ?? ""),
        reads: String(body.reads ?? ""),
        drafts: String(body.drafts ?? ""),
        must_not: String(body.mustNot ?? ""),
        enabled: body.enabled !== false,
        kind,
        phone: phone ?? "",
      });
      if (phone) {
        try {
          await addTextNumber(phone);
        } catch {
          /* The skill still keeps the number if the allowlist table is not there yet. */
        }
      }
      if (!(await storedSkill(skill))) return res.status(500).json({ error: CREATION_FAILED });
      return res.status(200).json({ skill, skills: await skillRows(), textNumbers: await listTextNumbers().catch(() => []) });
    }

    if (op === "text-number") {
      const phone = toE164(String(body.phone ?? ""));
      if (!phone) return res.status(400).json({ error: "That mobile number is not valid." });
      if (body.action === "remove") {
        const textNumbers = await removeTextNumber(phone);
        return res.status(200).json({ textNumbers, skills: await skillRows() });
      }
      const textNumbers = await addTextNumber(phone);
      return res.status(200).json({ textNumbers });
    }

    if (op === "rename") {
      await renameChat(String(body.chatId ?? ""), String(body.title ?? ""));
      return res.status(200).json({ chats: await listChats() });
    }

    if (op === "delete-chat") {
      await deleteChat(String(body.chatId ?? ""));
      return res.status(200).json({ chats: await listChats() });
    }

    if (op === "password") {
      const next = String(body.next ?? "");
      const confirm = String(body.confirm ?? "");
      if (!next || next !== confirm) return res.status(200).json({ ok: false, code: "mismatch" });
      if (!passwordMatches(String(body.current ?? ""))) return res.status(200).json({ ok: false, code: "current" });
      return res.status(200).json({ ok: false, code: "server" });
    }

    return res.status(400).json({ error: "Unknown op." });
  } catch (err) {
    if (isFilesystemError(err) && sendText) {
      const answer = asksPropertyReport(sendText) ? REPORT_FILE_FAILURE : "That could not be saved.";
      const chatId = sendChatId;
      const now = new Date().toISOString();
      if (chatId) {
        try {
          await addMessage({ chatId, role: "assistant", body: answer, thought: "Nothing was sent." });
        } catch {
          /* The transcript file is not writable. The answer still stays in this response. */
        }
      }
      const saved = chatId ? await listMessages(chatId).catch(() => []) : [];
      const messages = [...saved];
      if (!messages.some((row) => row.role === "user" && row.body === sendText)) {
        messages.push({ id: "kept-request", chat_id: chatId, created_at: now, role: "user", body: sendText, draft: null });
      }
      if (!messages.some((row) => row.role === "assistant" && row.body === answer)) {
        messages.push({ id: "kept-answer", chat_id: chatId, created_at: now, role: "assistant", body: answer, draft: null, thought: "Nothing was sent." });
      }
      return res.status(200).json({
        chatId,
        messages,
        chats: await listChats().catch(() => []),
        pending: false,
      });
    }
    const message = isFilesystemError(err) ? "That could not be saved." : err instanceof Error ? err.message : "Copilot failed.";
    return res.status(500).json({ error: message });
  }
}
