import type { ParityMail, ParityMemory, ParityMessage, ParityProperty, ParityReservation, ParityWorld } from "./world.js";

export const ID = {
  charlotte: "00000000-0000-4000-8000-000000000606",
  rose: "00000000-0000-4000-8000-000000000041",
  blue: "00000000-0000-4000-8000-000000000318",
  shaw: "00000000-0000-4000-8000-000000001065",
  outCharlotte: "00000000-0000-4000-8000-000000001104",
  scarborough: "00000000-0000-4000-8000-000000000010",
  partner: "00000000-0000-4000-8000-000000000099",
};

export const CODE = {
  diane: "HMESPTA3TJ",
  cancelled: "HM5BDH4TBN",
  scarborough: "HMSCARBR01",
  charlotte: "HMCHAR0606",
  shaw: "HMSHAW0912",
};

export const OPEN_ITEM = "Supabase org over its free storage limit, 1.14 GB of 1.1 GB, grace period ends Oct 27 2026, Pro upgrade pending";

export const BUILDING_MEMORY = [
  "Building contacts: supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com.",
  "Parking at 20 Blue Jays Way Unit 318: one tandem spot P4-62 that fits two cars.",
  "Sign-off: Shane, Co-Host 647-822-0448.",
  "Snack rule: note diet flags, promise no specific items.",
].join("\n");

const PROPERTIES: ParityProperty[] = [
  { id: ID.charlotte, name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true },
  { id: ID.rose, name: "Bright and comfortable home for families", address: "floor 2, 41 Roseglor Crescent, Toronto", managed: true },
  { id: ID.blue, name: "1,100SqFt 2B+Den, TIFF", address: "318, 20 Blue Jays Way, Toronto", managed: true },
  { id: ID.shaw, name: "Chic 2BR with Yard and Parking", address: "1065 Shaw Street, Toronto", managed: true },
  { id: ID.outCharlotte, name: "8 Charlotte 1104, King St W Condo with Projector and Balcony", address: "1104, 8 Charlotte St, Toronto", managed: false },
  { id: ID.scarborough, name: "Spacious 3BR Family Retreat, Sleeps 10", address: "Scarborough, Toronto", managed: false },
  { id: ID.partner, name: "Partner Loft we do not manage", address: "99 Partner Street, Toronto", managed: false },
];

const MEMORY: ParityMemory[] = [
  { path: "memory/units-we-manage.md", body: "8 Charlotte 606\nRoseglor, 41 Roseglor Crescent\n20 Blue Jays Way Unit 318\n1065 Shaw Street" },
  { path: "memory/building-318.md", body: BUILDING_MEMORY },
];

function msg(id: string, at: string, role: ParityMessage["role"], name: string, body: string): ParityMessage {
  return { id, at, role, name, body };
}

function stay(input: Omit<ParityReservation, "adults" | "children" | "messages"> & { adults?: number; children?: number; messages?: ParityMessage[] }): ParityReservation {
  return { adults: 1, children: 0, messages: [], ...input };
}

export function reservations(shawHostReply = false): ParityReservation[] {
  const shawMessages = [
    msg("shaw-guest", "2026-10-06T18:10:00-04:00", "guest", "Priya", "We expect to arrive around 9:30 PM."),
  ];
  if (shawHostReply) {
    shawMessages.push(msg("shaw-host", "2026-10-06T18:40:00-04:00", "host", "Shane", "See you this evening."));
  }
  return [
    stay({
      id: "00000000-0000-4000-8000-000000000d01",
      code: CODE.diane,
      propertyId: ID.blue,
      status: "accepted",
      checkIn: "2026-10-09",
      checkOut: "2026-10-12",
      guest: "Diane",
      adults: 4,
      children: 4,
      messages: [
        msg("diane-1", "2026-10-06T16:54:00-04:00", "guest", "Diane", "One guest is gluten-free and one is lactose-free. We are bringing two cars. Are there two parking spaces?"),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000c01",
      code: CODE.cancelled,
      propertyId: ID.blue,
      status: "cancelled",
      checkIn: "2026-10-20",
      checkOut: "2026-10-23",
      guest: "Jonah",
      messages: [
        msg("cancel-guest", "2026-09-30T11:00:00-04:00", "guest", "Jonah", "I have to cancel because my travel plans changed."),
        msg("cancel-host", "2026-09-30T12:00:00-04:00", "host", "Ryan", "Sorry your plans changed. I have cancelled the stay."),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000a01",
      code: CODE.charlotte,
      propertyId: ID.charlotte,
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Elena",
      adults: 2,
      children: 0,
      messages: [
        msg("elena-1", "2026-10-06T09:00:00-04:00", "guest", "Elena", "Could we have another set of keys? Can the dirty windows be cleaned? The shower pressure is very strong."),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000b01",
      code: CODE.scarborough,
      propertyId: ID.scarborough,
      status: "accepted",
      checkIn: "2026-10-02",
      checkOut: "2026-10-05",
      guest: "Marcus",
      adults: 4,
      children: 0,
      messages: [
        msg("marcus-1", "2026-10-02T08:00:00-04:00", "guest", "Marcus", "Could we get a larger frying pan and some garbage bags?"),
        msg("marcus-host", "2026-10-02T09:00:00-04:00", "host", "Shane", "I left a larger frying pan and garbage bags at the entrance."),
        msg("marcus-2", "2026-10-05T10:00:00-04:00", "guest", "Marcus", "How do I start the dishwasher?"),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000e01",
      code: CODE.shaw,
      propertyId: ID.shaw,
      status: "accepted",
      checkIn: "2026-10-06",
      checkOut: "2026-10-12",
      guest: "Priya",
      messages: shawMessages,
    }),
    stay({
      id: "00000000-0000-4000-8000-000000001104",
      code: "HM1104OUT1",
      propertyId: ID.outCharlotte,
      status: "accepted",
      checkIn: "2026-10-08",
      checkOut: "2026-10-11",
      guest: "Wes",
      messages: [
        msg("wes-1", "2026-10-01T12:00:00-04:00", "guest", "Wes", "We are staying at 8 Charlotte 1104, King St W Condo with Projector and Balcony."),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000099",
      code: "HMPARTNER1",
      propertyId: ID.partner,
      status: "accepted",
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      guest: "Ned",
      messages: [
        msg("ned-1", "2026-10-01T12:30:00-04:00", "guest", "Ned", "Question about the Partner Loft we do not manage."),
      ],
    }),
  ];
}

export function ryanMail(): ParityMail {
  return {
    id: "ryan-preapprove",
    mailbox: "gmail",
    folder: "inbox",
    from: "Airbnb",
    email: "automated@airbnb.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-07T06:26:00-04:00",
    subject: "Ryan sent a pre-approval",
    snippet: "Pre-approval for Spacious 3BR Family Retreat, Nov 4 to Nov 7, 10 adults.",
    body: "Ryan sent the guest a pre-approval for Spacious 3BR Family Retreat, Sleeps 10, in Scarborough, Nov 4 2026 to Nov 7 2026, 10 adults. It expires in 24 hours if they do not accept. The dates stay open until they do. No booking is confirmed.",
    airbnb: true,
  };
}

export function worldAt(iso: string, shawHostReply = false, mail: ParityMail[] = []): ParityWorld {
  return {
    now: new Date(iso),
    properties: PROPERTIES,
    reservations: reservations(shawHostReply),
    gmail: mail,
    outlook: [],
    memory: MEMORY,
    items: [
      {
        id: "supabase-storage",
        text: OPEN_ITEM,
        verifiedOn: "2026-10-05",
        status: "open",
      },
    ],
  };
}
