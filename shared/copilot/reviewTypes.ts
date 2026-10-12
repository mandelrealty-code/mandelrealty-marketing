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
  /** Every managed property, in the order the filter shows them. */
  properties?: ReviewQueueProperty[];
};

export const NO_REVIEWS_SYNCED = "No reviews synced for this property yet";
