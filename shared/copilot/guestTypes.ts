export type GuestMedia = {
  kind: "photo" | "video";
  url: string;
  duration: string;
  shows: string;
};

export type GuestFile = {
  name: string;
  mime: string;
  data: string;
};

export type GuestPropertyChip = {
  id: string;
  label: string;
  failed: boolean;
};

export type GuestRow = {
  id: string;
  guest: string;
  first: string;
  initials: string;
  guestPhoto: string;
  property: string;
  propertyId: string;
  propertyPhoto: string;
  asked: string;
  askedEn: string;
  language: string;
  wait: string;
  waitedMs: number;
  thanks: boolean;
  lane: "reply" | "guest" | "none";
  status: string;
  statusLead: string;
  statusRest: string;
  watch: string;
  when: string;
  urgent: boolean;
  dates: string;
  checkIn: string;
  checkOut: string;
  mediaLabel: string;
  lastNote: string;
  /** When the latest message in the thread was sent. */
  activityAt?: string;
  /** The latest message, whoever sent it, as the inbox shows it. */
  preview?: string;
  /** An inquiry conversation: its messages come from the inquiry, not a reservation. */
  inquiry?: boolean;
  /** The host who sent the latest message, when a host sent it. The inbox shows "Sam: …". */
  lastBy?: string;
  /** Why a thread whose guest wrote last does not need a reply: cancelled, superseded, closed, passed. */
  quietReason?: string;
  /** Hospitable reservation or inquiry status when it was last known (accepted, cancelled, …). */
  bookingStatus?: string;
};

export type GuestBubble = {
  role: "guest" | "host" | "automated";
  who: string;
  at: string;
  time: string;
  text: string;
  english: string;
  language: string;
  media: GuestMedia[];
  flag: string;
  /** This sender's profile photo when Hospitable returned one. Empty for co-travelers without a photo. */
  photo?: string;
};

export type GuestDraftView = {
  id: string;
  guest: string;
  first: string;
  initials: string;
  guestPhoto: string;
  property: string;
  propertyId: string;
  propertyPhoto: string;
  stay: string;
  wait: string;
  asked: string;
  language: string;
  statusLead: string;
  statusRest: string;
  dates: string;
  checkIn?: string;
  checkOut?: string;
  when: string;
  lane: "reply" | "guest" | "none";
  status: string;
  thread: GuestBubble[];
  mode: "hub" | "gap" | "saved" | "held";
  draft: string;
  alternates: string[];
  sendable: boolean;
  situation: string;
  waitingLine: string;
  watch: string;
  partnerNotes: string[];
  basedOn: string;
  sourceLine: string;
  mediaSlot: string;
  sentVersion: string;
  facts: string;
  gap: string;
  savedLine: string;
  failedLine: string;
  /** Shown from the inbox row while the full thread loads. */
  loading?: boolean;
};

/** An open loop inside a thread. Separate from who owes the next reply. */
/** ask: a guest asked for early check-in or late checkout. Copilot only notices it. */
export type GuestFollowUpKind = "owe" | "incident" | "inquiry" | "ask";

/**
 * The exact message a follow-up stands on, from the SAME guest's own thread. The follow-up's wording is built from this
 * quote alone. No quote, no follow-up: it is checked against the thread again at every run, and closes itself when the
 * quote isn't there or doesn't support the wording. Facts never travel between threads.
 */
export type FollowUpGrounding = {
  /** The message text, exactly as written in the thread. */
  quote: string;
  at: string;
  role: "guest" | "host";
  name: string;
  /** Other messages from the same thread the wording also uses: the host's promise behind a guest's ask, the guest's reply that agreed. */
  also?: { quote: string; at: string; role: "guest" | "host"; name: string; as: "promise" | "ask" | "agreement" }[];
};

export type GuestFollowUp = {
  id: string;
  kind: GuestFollowUpKind;
  reservationId: string;
  guest: string;
  first: string;
  initials: string;
  guestPhoto: string;
  property: string;
  propertyId: string;
  propertyPhoto: string;
  dates: string;
  stay: string;
  checkIn: string;
  checkOut: string;
  line: string;
  tag: string;
  sourceLine: string;
  sourceAt: string;
  due: string;
  dueLabel: string;
  dueSub: string;
  dueText: string;
  dueNow: boolean;
  /** Right-hand label on the queue row. */
  when: string;
  whenSub: string;
  /** thread = a date written in the messages. stay = the next stay date. empty = no date given. */
  dueFrom: "thread" | "stay" | "";
  onOrAfter: boolean;
  topic: string;
  promised: string;
  promisedBy: string;
  promisedAt: string;
  promisedWhen: string;
  agreed: string;
  agreedBy: string;
  agreedAt: string;
  agreedWhen: string;
  /** agreed = the guest accepted. asked = they are waiting and have not answered yet. */
  agreedAs: "agreed" | "asked" | "";
  what: string;
  sentBy: string;
  sentWhen: string;
  since: string;
  resolvesWhen: string;
  expiresAt: string;
  draft: string;
  notes: string[];
  /** The quote this follow-up stands on, from this guest's own thread. Every owe, incident and ask has one. */
  grounding?: FollowUpGrounding;
  /** Present on an inquiry built from a booking request. */
  newToAirbnb?: boolean;
  joined?: string;
  nights?: string;
  guestCount?: string;
  price?: string;
  rulesConfirmed?: boolean;
  rulesQuote?: string;
  rulesWhen?: string;
  airbnbUrl?: string;
  phase?: "" | "verifying-approve" | "verifying-decline";
  suggested?: "approve" | "rules";
  declineDraft?: string;
};

export type GuestFollowUpClose = {
  id: string;
  guest: string;
  closeText: string;
  /** The follow-up as it stood before it closed, so later answers can cite it. */
  record?: GuestFollowUp;
};

export type GuestQueue = {
  connected: boolean;
  line: string;
  summaryLead: string;
  summaryRest: string;
  waiting: GuestRow[];
  onGuest: GuestRow[];
  held: GuestRow[];
  thanks: GuestRow[];
  /** Every other conversation: ended, nothing owed, or not read in time. Still listed. */
  quiet?: GuestRow[];
  failed: string[];
  properties: GuestPropertyChip[];
  followUps: GuestFollowUp[];
  closedFollowUps: GuestFollowUpClose[];
  /** The same sentence Chat uses for who is waiting. */
  answer: string;
  /** When the last full Hospitable inbox scan finished. Fast refreshes use this instead of re-scanning. */
  scannedAt?: string;
};
