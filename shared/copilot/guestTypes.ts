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
  /** The same sentence Chat uses for who is waiting. */
  answer: string;
};
