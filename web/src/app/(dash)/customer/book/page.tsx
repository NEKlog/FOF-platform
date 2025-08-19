// web/src/app/(dash)/customer/book/page.tsx
import BookingClient from "./booking.client";

export default async function BookPage({
  searchParams,
}: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const initialKind = (sp?.kind ?? "") as any;
  return <BookingClient initialKind={initialKind} />;
}
