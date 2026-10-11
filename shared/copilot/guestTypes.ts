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
};

export type GuestBubble = {
  role: "guest" | "host";
  who: string;
  at: string;
  time: string;
  text: string;
  english: string;
  language: string;
  media: GuestMedia[];
  flag: string;
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
};

/** An open loop inside a thread. Separate from who owes the next reply. */
export type GuestFollowUpKind = "owe" | "incident" | "inquiry";

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
  failed: string[];
  properties: GuestPropertyChip[];
  followUps: GuestFollowUp[];
  closedFollowUps: GuestFollowUpClose[];
  /** The same sentence Chat uses for who is waiting. */
  answer: string;
};
