// web/src/app/page.tsx
import CategoryGrid from "@/components/CategoryGrid";

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Få 3 tilbud på din opgave</h1>
      <CategoryGrid hrefBase="/customer/book" />
    </>
  );
}
