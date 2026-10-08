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
};

export type GuestBubble = {
  role: "guest" | "host";
  who: string;
  time: string;
  text: string;
  english: string;
  language: string;
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
  language: string;
  thread: GuestBubble[];
  mode: "hub" | "gap" | "saved";
  draft: string;
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
  thanks: GuestRow[];
  failed: string[];
};
