export type ReviewFact = {
  claim: string;
  record: string;
  source: string;
};

export type ReviewQueueRow = {
  id: string;
  reservationId: string;
  propertyId: string;
  guest: string;
  initials: string;
  guestPhoto: string;
  property: string;
  propertyPhoto: string;
  stars: number;
  when: string;
  reviewedAt: string;
  review: string;
  draft: string;
  sourceLine?: string;
  previous?: string;
  dispute: string;
  needsCare?: boolean;
  facts: ReviewFact[];
  returned: boolean;
  /** 3 stars or fewer: shown to the team first, with an assessment instead of a ready reply. */
  flagged?: boolean;
  /** Whether the review may be retaliatory under Airbnb's Reviews Policy, with the guest's own words. */
  retaliation?: { level: "likely" | "possible" | "no"; why: string; quotes: string[] };
  /** A removal request to file with Airbnb by hand. Copilot never files it. */
  removalRequest?: string;
  /** The guest's private feedback to the host (never posted). */
  privateFeedback?: string;
};

export type PostedReviewLine = {
  text: string;
  at: string;
};

/** One managed property in the Reviews filter, shown even when it has nothing waiting. */
export type ReviewQueueProperty = {
  id: string;
  name: string;
  /** False only when Hospitable returned no reviews at all for it, answered or not. */
  synced: boolean;
};

export type ReviewQueuePayload = {
  connected: boolean;
  line: string;
  reviews: ReviewQueueRow[];
  postedToday: PostedReviewLine[];
  /** Reviews hidden because Airbnb no longer takes a reply to them, and properties whose reviews couldn't be read. */
  note?: string;
  /** Every managed property, in the order the filter shows them. */
  properties?: ReviewQueueProperty[];
};

export const NO_REVIEWS_SYNCED = "No reviews synced for this property yet";
