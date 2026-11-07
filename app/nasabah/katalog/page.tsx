import { connection } from "next/server";
import { KatalogHarga } from "@/components/katalog-harga";

export default async function NasabahKatalogPage() {
  await connection();
  return (
    <div className="py-2">
      <KatalogHarga />
    </div>
  );
}
