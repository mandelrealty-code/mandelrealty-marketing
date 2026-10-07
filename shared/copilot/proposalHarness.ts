/**
 * Proves a unit proposal is sourced, priced, edited, and unsent until Submit.
 * Fixture pages and a stubbed image provider. No live retailer, AirROI, or email.
 */

import { linesInPdf } from "./contractPdf.js";
import { worldAt } from "./parity/catalog.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { installWorld } from "./parity/world.js";
import { listPmClients } from "../pm/clientStore.js";
import { listProposals } from "../pm/proposalStore.js";
import type { ProposalItem, ProposalRecord, ProposalRoom } from "../pm/proposalStore.js";
import { commitProposalSend, installProposalComps, installProposalPictures, proposalPictureLog, sameItem } from "./proposal.js";
import { installResearch, type ResearchPage } from "./skillResearch.js";
import { callCopilotTool } from "./toolServer.js";

const NOW = "2026-10-07T11:00:00-04:00";
const PHOTO = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fail(message: string): never {
  throw new Error(message);
}

function page(title: string, url: string, text: string): ResearchPage {
  return { title, url, text };
}

function room(proposal: ProposalRecord, name: string): ProposalRoom {
  const found = proposal.rooms.find((row) => row.name === name);
  if (!found) fail(`missing ${name}`);
  return found;
}

function item(proposal: ProposalRecord, need: string): ProposalItem {
  for (const row of proposal.rooms) {
    const found = row.items.find((entry) => entry.need === need);
    if (found) return found;
  }
  fail(`missing ${need}`);
}

const pages = [
  page("sofa for the living room", "https://example.test/oak-sofa", "Product: Oak sofa\nPrice: 800.00 CAD\nDimensions: 84 x 38 x 34 in\nImage: https://example.test/oak-sofa.jpg\nQuality: solid oak\nRetailer: Example Furniture"),
  page("desk for the living room", "https://example.test/desk", "Product: Writing desk\nPrice: 350.00 CAD\nDimensions: 60 x 30 x 30 in\nImage: https://example.test/desk.jpg\nQuality: wood\nRetailer: Example Furniture"),
  page("rug for the living room", "https://example.test/rug", "Product: Wool rug\nPrice: 200.00 CAD\nDimensions: 96 x 120 in\nImage: https://example.test/rug.jpg\nQuality: wool\nRetailer: Example Furniture"),
  page("bed for the bedroom", "https://example.test/bed", "Product: Queen bed\nPrice: 900.00 CAD\nDimensions: 80 x 60 x 40 in\nImage: https://example.test/bed.jpg\nQuality: wood\nRetailer: Example Furniture"),
  page("nightstand for the bedroom", "https://example.test/nightstand", "Product: Wood nightstand\nPrice: 80.00 CAD\nImage: https://example.test/nightstand.jpg\nQuality: wood\nRetailer: Example Furniture"),
  page("cheaper sofa", "https://example.test/fabric-sofa", "Product: Fabric sofa\nPrice: 420.00 CAD\nDimensions: 78 x 35 x 32 in\nImage: https://example.test/fabric-sofa.jpg\nQuality: fabric\nRetailer: Example Furniture"),
  page("cheaper desk", "https://example.test/desk-same", "Product: Writing desk\nPrice: 350.00 CAD\nDimensions: 60 x 30 x 30 in\nImage: https://example.test/desk.jpg\nQuality: wood\nRetailer: Example Furniture"),
  page("cheaper rug", "https://example.test/rug-same", "Product: Wool rug\nPrice: 200.00 CAD\nDimensions: 96 x 120 in\nImage: https://example.test/rug.jpg\nQuality: wool\nRetailer: Example Furniture"),
  page("cheaper bed", "https://example.test/bed-same", "Product: Queen bed\nPrice: 900.00 CAD\nDimensions: 80 x 60 x 40 in\nImage: https://example.test/bed.jpg\nQuality: wood\nRetailer: Example Furniture"),
  page("cheaper nightstand", "https://example.test/nightstand-same", "Product: Wood nightstand\nPrice: 80.00 CAD\nImage: https://example.test/nightstand.jpg\nQuality: wood\nRetailer: Example Furniture"),
];

installWorld(worldAt(NOW));
installResearch(pages);
installProposalPictures();
installProposalComps({ count: 8, lowCents: 4_200_000, highCents: 6_100_000, currency: "CAD" });
resetCaptures();

const built = await callCopilotTool("build_proposal", {
  client: "Elena Voss",
  email: "elena@example.com",
  address: "88 Ossington Avenue",
  now: NOW,
  rooms: [
    { name: "Living room", length: 14, width: 12, unit: "ft", photo: PHOTO, photoMime: "image/png" },
    { name: "Bedroom", length: 11, width: 10, unit: "ft", photo: PHOTO, photoMime: "image/png" },
  ],
}) as { body: string; proposal: ProposalRecord | null; draft: { proposalSend?: { proposalId: string } } | null; regenerated: string[] };

if (!built.proposal || built.draft) fail(built.body);
const first = built.proposal;
if (first.version !== 1) fail(`version ${first.version}`);
if (first.rooms.reduce((sum, row) => sum + row.totalCents, 0) !== first.total_cents) fail("the full total is not the sum of the rooms");
if (room(first, "Living room").totalCents !== 135000 || room(first, "Bedroom").totalCents !== 98000 || first.total_cents !== 233000) fail(`totals ${first.total_cents}`);
const sofa = item(first, "sofa");
const nightstand = item(first, "nightstand");
if (sofa.currency !== "CAD" || sofa.priceCents !== 80000 || sofa.url !== "https://example.test/oak-sofa" || sofa.fit !== "fits" || !sofa.imageUrl) fail(JSON.stringify(sofa));
if (nightstand.fit !== "unconfirmed" || nightstand.priceCents !== 8000) fail(JSON.stringify(nightstand));
if (!/estimate range from comps/i.test(first.estimate) || !/8 listings/.test(first.estimate) || !/not a promise/i.test(first.estimate) || !/CAD/.test(first.estimate)) fail(first.estimate);
if (first.images_note) fail(first.images_note);
if (proposalPictureLog().join("|") !== "Living room|Bedroom") fail(proposalPictureLog().join("|"));
if (room(first, "Living room").beforePhoto !== PHOTO || !room(first, "Living room").afterImage) fail("the before photo or after image is missing");
const firstLines = linesInPdf(first.pdf).join("\n");
if (!/Fit: fits/.test(firstLines) || !/Fit: unconfirmed/.test(firstLines) || !/https:\/\/example\.test\/oak-sofa/.test(firstLines)) fail(firstLines);
if (!/Before/.test(firstLines) || !/After:/.test(firstLines) || !/not a promise/i.test(firstLines) || /not connected/i.test(firstLines)) fail(firstLines);
if (capturedCommits().length) fail("the build sent something");

const cheaper = await callCopilotTool("edit_proposal", {
  instruction: "make this cheaper",
  proposal_id: first.id,
  now: NOW,
}) as { body: string; proposal: ProposalRecord | null; changed: string[]; regenerated: string[] };
if (!cheaper.proposal || cheaper.proposal.version !== 2) fail(cheaper.body);
if (!(cheaper.proposal.total_cents < first.total_cents) || cheaper.proposal.total_cents !== 195000) fail(`cheaper total ${cheaper.proposal.total_cents}`);
if (item(cheaper.proposal, "sofa").product !== "Fabric sofa" || item(cheaper.proposal, "sofa").priceCents !== 42000) fail("the sofa was not swapped");
if (!sameItem(item(first, "desk"), item(cheaper.proposal, "desk")) || !sameItem(item(first, "rug"), item(cheaper.proposal, "rug"))) fail("an item that was not swapped changed");
if (!sameItem(item(first, "bed"), item(cheaper.proposal, "bed")) || !sameItem(item(first, "nightstand"), item(cheaper.proposal, "nightstand"))) fail("the bedroom items changed");
if (cheaper.regenerated.join("|") !== "Living room") fail(cheaper.regenerated.join("|"));
if (room(cheaper.proposal, "Living room").afterImage === room(first, "Living room").afterImage) fail("the living room image was not regenerated");
if (room(cheaper.proposal, "Bedroom").afterImage !== room(first, "Bedroom").afterImage) fail("the bedroom image changed");
if (!/became/.test(cheaper.body) || !/fabric/i.test(cheaper.body) || !/Size /.test(cheaper.body)) fail(cheaper.body);
if (cheaper.proposal.pdf.equals(first.pdf)) fail("the cheaper edit did not make a new PDF");
if (capturedCommits().length) fail("the edit sent something");

const moved = await callCopilotTool("edit_proposal", {
  instruction: "move the desk to the bedroom",
  proposal_id: cheaper.proposal.id,
  now: NOW,
}) as { proposal: ProposalRecord | null; regenerated: string[]; body: string };
if (!moved.proposal) fail(moved.body);
if (room(moved.proposal, "Living room").items.some((row) => row.need === "desk")) fail("the desk stayed in the living room");
if (!room(moved.proposal, "Bedroom").items.some((row) => row.need === "desk")) fail("the desk is not in the bedroom");
if (room(moved.proposal, "Living room").totalCents !== 62000 || room(moved.proposal, "Bedroom").totalCents !== 133000 || moved.proposal.total_cents !== 195000) fail(`move totals ${moved.proposal.total_cents}`);
if (moved.regenerated.join("|") !== "Living room|Bedroom") fail(moved.regenerated.join("|"));
if (room(moved.proposal, "Living room").afterImage === room(cheaper.proposal, "Living room").afterImage) fail("the living room image did not regenerate after the move");
if (room(moved.proposal, "Bedroom").afterImage === room(cheaper.proposal, "Bedroom").afterImage) fail("the bedroom image did not regenerate after the move");
if (moved.proposal.version !== 3) fail(`move version ${moved.proposal.version}`);

const removed = await callCopilotTool("edit_proposal", {
  instruction: "take out the rug, we don't need it",
  proposal_id: moved.proposal.id,
  now: NOW,
}) as { proposal: ProposalRecord | null; regenerated: string[]; body: string };
if (!removed.proposal) fail(removed.body);
const removedProposal = removed.proposal;
if (removedProposal.rooms.some((row) => row.items.some((entry) => entry.need === "rug"))) fail("the rug is still on the proposal");
if (room(removedProposal, "Living room").totalCents !== 42000 || removedProposal.total_cents !== 175000) fail(`remove total ${removedProposal.total_cents}`);
if (room(removedProposal, "Living room").totalCents + room(removedProposal, "Bedroom").totalCents !== removedProposal.total_cents) fail("totals drifted");
if (removed.regenerated.join("|") !== "Living room") fail(removed.regenerated.join("|"));
if (room(removedProposal, "Bedroom").afterImage !== room(moved.proposal, "Bedroom").afterImage) fail("the bedroom image changed when the rug was removed");
if (room(removedProposal, "Living room").afterImage === room(moved.proposal, "Living room").afterImage) fail("the living room image was not regenerated");
if (removedProposal.version !== 4 || removedProposal.pdf.equals(moved.proposal.pdf)) fail("the removal did not save a new PDF");

const client = (await listPmClients()).find((row) => row.name === "Elena Voss");
if (!client) fail("the prospect was not saved in OPS");
const versions = await listProposals(client.id);
if (versions.length !== 4 || !versions.some((row) => row.id === first.id && row.version === 1)) fail(`versions ${versions.map((row) => row.version).join(",")}`);
if (versions.some((row) => row.status === "sent")) fail("a version was marked sent before Submit");

const prepared = await callCopilotTool("send_proposal", { proposal_id: removedProposal.id }) as { draft: { proposalSend?: { proposalId: string; to: string } } | null; body: string };
if (!prepared.draft?.proposalSend || prepared.draft.proposalSend.to !== "elena@example.com") fail(prepared.body);
if (capturedCommits().length) fail("preparing the email sent it");
const said = await commitProposalSend(prepared.draft.proposalSend.proposalId, new Date(NOW));
if (!/sent on October 7, 2026/.test(said)) fail(said);
if (capturedCommits().length !== 1 || capturedCommits()[0]?.connector !== "proposal" || capturedCommits()[0]?.detail !== "elena@example.com") fail(`sent ${capturedCommits().length}`);
const afterSend = await listProposals(client.id);
if (afterSend.length !== 4) fail("sending dropped a version");
if (afterSend.find((row) => row.id === removedProposal.id)?.status !== "sent") fail("Submit did not mark the proposal sent");
if (afterSend.find((row) => row.id === first.id)?.status !== "draft") fail("an earlier version was overwritten");

console.log("Proposal harness passed.");
