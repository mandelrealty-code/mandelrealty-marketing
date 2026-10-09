import type { ParityMail, ParityMemory, ParityMessage, ParityProperty, ParityReservation, ParityWorld } from "./world.js";
import { BLUE_JAYS_PROCESS } from "../processFacts.js";

export const ID = {
  charlotte: "00000000-0000-4000-8000-000000000606",
  rose: "00000000-0000-4000-8000-000000000041",
  blue: "00000000-0000-4000-8000-000000000318",
  shaw: "00000000-0000-4000-8000-000000001065",
  outCharlotte: "00000000-0000-4000-8000-000000001104",
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

export const BUILDING_MEMORY = BLUE_JAYS_PROCESS;

const HUB = {
  charlotte: [
    "Check-in 3:00 PM. Check-out 11:00 AM.",
    "Luggage drop-off from 12:30 PM may be allowed.",
    "Free parking on premises.",
    "No pets, no smoking, no events.",
    "Two paper towel rolls are left on the sink.",
  ].join("\n"),
  rose: [
    "Sleeps 10. Check-in 4:00 PM. Check-out 11:00 AM.",
    "Side-door private entrance.",
    "Free driveway parking, right side facing the house.",
    "Garbage bags and laundry detergent are in the gift basket on the kitchen counter.",
    "Two toilet paper rolls at check-in. Further supply is the guest's.",
    "Dishwasher: close the door fully, press and hold start for a few seconds. If there is no power, check the breaker (panel opposite the washer and dryer, or behind the picture in the third bedroom). If it trips again, message the host.",
  ].join("\n"),
  blue: [
    "No smoking, no events.",
    "Pets are allowed with restrictions. The pet fee is paid through Airbnb.",
    "Welcome items include teas, coffees, cream, brown sugar, water, pops, juice, cookies and fruit.",
  ].join("\n"),
  shaw: [
    "Sleeps 4. Check-out 12:00 PM.",
    "Free parking, deck and backyard.",
    "Quiet hours 10:00 PM to 9:00 AM.",
    "No visitors beyond confirmed guests.",
    "Shoes off inside.",
    "Laundry after 7:00 PM on weekdays.",
    "Garbage bags go to the bins at the front side of the house.",
    "Netflix on the Shaw profile only.",
  ].join("\n"),
};

const PROPERTIES: ParityProperty[] = [
  { id: ID.charlotte, name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true },
  {
    id: ID.rose,
    name: "Bright and comfortable home for families",
    publicName: "Spacious 3BR Family Retreat | Sleeps 10",
    address: "floor 2, 41 Roseglor Crescent, Toronto",
    managed: true,
  },
  { id: ID.blue, name: "1,100SqFt 2B+Den, TIFF", address: "318, 20 Blue Jays Way, Toronto", managed: true },
  {
    id: ID.shaw,
    name: "Chic 2BR with Yard and Parking",
    address: "1065 Shaw Street, Toronto",
    managed: true,
    neighbourhood: "Shaw Street, Toronto",
    description: "A chic two-bedroom house with a yard and parking, easy for a weekend in the neighbourhood.",
    amenities: ["Free parking", "Deck", "Backyard"],
  },
  { id: ID.outCharlotte, name: "8 Charlotte 1104, King St W Condo with Projector and Balcony", address: "1104, 8 Charlotte St, Toronto", managed: false },
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
    msg("shaw-guest", "2026-10-04T16:37:00-04:00", "guest", "Michael", "We expect to arrive around 930 pm"),
  ];
  if (shawHostReply) {
    shawMessages.push(msg("shaw-host", "2026-10-04T17:00:00-04:00", "host", "Shane", "See you this evening."));
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
      financials: {
        currency: "CAD",
        guest: {
          total_price: { amount: 184735, formatted: "$1,847.35" },
          accommodation: { amount: 150000, formatted: "$1,500.00" },
          fees: [
            { label: "Cleaning fee", amount: 22500, formatted: "$225.00" },
            { label: "Guest service fee", amount: 12235, formatted: "$122.35" },
          ],
        },
        host: {
          revenue: { amount: 162000, formatted: "$1,620.00" },
          accommodation: { amount: 150000, formatted: "$1,500.00" },
          guest_fees: [{ label: "Cleaning fee", amount: 22500, formatted: "$225.00" }],
          host_fees: [{ label: "Host service fee", amount: -10500, formatted: "-$105.00" }],
        },
      },
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000c01",
      code: CODE.cancelled,
      propertyId: ID.blue,
      status: "cancelled",
      checkIn: "2026-10-06",
      checkOut: "2026-10-09",
      guest: "Yingjia",
      messages: [
        // Clock times were not supplied. Order is the guest, then Ryan's reply already in the thread on Sep 30.
        msg("cancel-guest", "2026-09-30T00:00:00-04:00", "guest", "Yingjia", "My travel plans changed."),
        msg("cancel-host", "2026-09-30T00:00:01-04:00", "host", "Ryan", "Is there anything we can do?"),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000a01",
      code: CODE.charlotte,
      propertyId: ID.charlotte,
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Eloise",
      adults: 2,
      children: 0,
      messages: [
        msg("eloise-1", "2026-10-02T08:33:00-04:00", "guest", "Eloise", "Could we have another set of keys? The windows are dirty. The shower pressure is very strong."),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000b01",
      code: CODE.scarborough,
      propertyId: ID.rose,
      status: "accepted",
      checkIn: "2026-10-02",
      checkOut: "2026-10-05",
      guest: "Gaspard",
      adults: 4,
      children: 0,
      messages: [
        msg("gaspard-pan", "2026-10-03T07:33:00-04:00", "guest", "Gaspard", "Could we get a larger frying pan?"),
        msg("gaspard-bags", "2026-10-03T07:53:00-04:00", "guest", "Gaspard", "Could we get garbage bags?"),
        msg("gaspard-precilla-1", "2026-10-03T08:20:00-04:00", "host", "Precilla", "I'll bring a larger frying pan and garbage bags."),
        // Both at 8:24 AM. The extra seconds keep Ryan's reply ahead of Gaspard's follow-up.
        msg("gaspard-ryan-1", "2026-10-03T08:24:00-04:00", "host", "Ryan", "I'll handle the larger frying pan and the garbage bags as well."),
        msg("gaspard-bags-missing", "2026-10-03T08:24:30-04:00", "guest", "Gaspard", "The bags seem missing."),
        msg("gaspard-ryan-2", "2026-10-03T08:36:00-04:00", "host", "Ryan", "I'll sort out the missing garbage bags."),
        msg("gaspard-precilla-2", "2026-10-03T08:45:00-04:00", "host", "Precilla", "The drop-off is confirmed."),
        // Next guest message after the 8:45 AM confirmation. The source did not give this clock minute.
        msg("gaspard-dishwasher", "2026-10-03T08:45:01-04:00", "guest", "Gaspard", "How do I start the dishwasher? It looks unplugged."),
      ],
    }),
    stay({
      id: "00000000-0000-4000-8000-000000000e01",
      code: CODE.shaw,
      propertyId: ID.shaw,
      status: "accepted",
      checkIn: "2026-10-06",
      checkOut: "2026-10-12",
      guest: "Michael",
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
    snippet: "Pre-approval for Spacious 3BR Family Retreat | Sleeps 10, Nov 4 to Nov 7, 10 adults.",
    body: "Ryan sent the guest a pre-approval for Spacious 3BR Family Retreat | Sleeps 10 at 41 Roseglor Crescent, Nov 4 2026 to Nov 7 2026, 10 adults. It expires in 24 hours if they do not accept. The dates stay open until they do. No booking is confirmed.",
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
        source: "Supabase",
      },
    ],
    hub: [
      { propertyId: ID.charlotte, body: HUB.charlotte },
      { propertyId: ID.rose, body: HUB.rose },
      { propertyId: ID.blue, body: HUB.blue },
      { propertyId: ID.shaw, body: HUB.shaw },
    ],
  };
}
