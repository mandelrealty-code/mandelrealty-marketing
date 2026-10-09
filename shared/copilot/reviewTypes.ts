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

export type ReviewQueuePayload = {
  connected: boolean;
  line: string;
  reviews: ReviewQueueRow[];
  postedToday: PostedReviewLine[];
};
