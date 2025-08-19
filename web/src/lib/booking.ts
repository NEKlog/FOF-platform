// web/src/lib/booking.ts

// Lokale typer – uafhængige af Prisma
export type BookingCategory = "MOVING" | "FURNITURE" | "PARCEL" | "PALLET_LTL" | "FTL";
export type BookingKind = "FIXED" | "BID";

// (valgfrit) fælles metadata kan ligge her hvis du vil importere dem flere steder:
export const CATEGORY_LABEL: Record<BookingCategory, string> = {
  MOVING: "Flytning",
  FURNITURE: "Møbeltransport",
  PARCEL: "Pakker & Kurér",
  PALLET_LTL: "Paller & Stykgods (LTL)",
  FTL: "Fullload (FTL)",
};

