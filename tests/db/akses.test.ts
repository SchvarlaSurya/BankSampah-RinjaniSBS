import { describe, expect, it } from "vitest";
import { kodeDariPesanDb } from "@/contract";
import { bukaKoneksi } from "./clients";
import { CHECK_VIOLATION, PERMISSION_DENIED, expectPgError, pgErrorDari, tangkap } from "./errors";
import { buatKonteks, buatUser, isiSaldo } from "./factories";
import { itemsJson, koreksi, setor, tarik, uuidBaru } from "./ledger";

const { owner, app, anon, authenticated } = bukaKoneksi();

describe("H. hak akses", () => {
  it("setiap koneksi berjalan sebagai peran yang benar", async () => {
    const peran = async (sql: typeof owner) => (await sql`select current_user::text as u`)[0].u;
    expect(await peran(owner)).toBe("postgres");
    expect(await peran(app)).toBe("app_server");
    expect(await peran(anon)).toBe("anon");
    expect(await peran(authenticated)).toBe("authenticated");
  });

  for (const [nama, sql] of [
    ["anon", anon],
    ["authenticated", authenticated],
  ] as const) {
    it(`${nama}: tidak bisa SELECT transactions, saldo_nasabah, user`, async () => {
      await expectPgError(sql`select * from public.transactions limit 1`, { sqlstate: PERMISSION_DENIED });
      await expectPgError(sql`select * from public.saldo_nasabah limit 1`, { sqlstate: PERMISSION_DENIED });
      await expectPgError(sql`select * from public."user" limit 1`, { sqlstate: PERMISSION_DENIED });
    });

    it(`${nama}: tidak bisa EXECUTE setor/tarik/koreksi`, async () => {
      const k = await buatKonteks(owner);
      const asli = await isiSaldo(app, k, 1000);
      const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "1.00" }]);
      await expectPgError(setor(sql, { customerId: k.nasabah, adminId: k.admin, items }), {
        sqlstate: PERMISSION_DENIED,
        message: "permission denied for function setor",
      });
      await expectPgError(tarik(sql, { customerId: k.nasabah, adminId: k.admin, jumlah: 1 }), {
        sqlstate: PERMISSION_DENIED,
        message: "permission denied for function tarik",
      });
      await expectPgError(koreksi(sql, { originalId: asli, adminId: k.superAdmin }), {
        sqlstate: PERMISSION_DENIED,
        message: "permission denied for function koreksi",
      });
    });
  }

  it("app_server tidak bisa EXECUTE cek_request_ulang", async () => {
    await expectPgError(
      app`select * from public.cek_request_ulang(${uuidBaru()}::uuid, 'setor', 'x', 'y', null)`,
      { sqlstate: PERMISSION_DENIED, message: "permission denied for function cek_request_ulang" },
    );
  });

  it("user.role di luar tiga nilai ditolak (insert owner & update app_server)", async () => {
    await expectPgError(
      owner`insert into public."user" (id, name, email, role) values (${uuidBaru()}, 'x', ${`${uuidBaru()}@test.local`}, 'superadmin')`,
      { sqlstate: CHECK_VIOLATION, message: /user_role_valid/ },
    );
    const id = await buatUser(owner, "nasabah");
    await expectPgError(app`update public."user" set role = 'root' where id = ${id}`, {
      sqlstate: CHECK_VIOLATION,
      message: /user_role_valid/,
    });
  });
});

describe("I. isolation level", () => {
  for (const level of ["repeatable read", "serializable"] as const) {
    it(`${level}: setor/tarik/koreksi -> ISOLATION_LEVEL_TIDAK_DIDUKUNG`, async () => {
      const k = await buatKonteks(owner);
      const asli = await isiSaldo(app, k, 1000);
      const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "1.00" }]);
      const panggilan = [
        (tx: typeof app) => setor(tx, { customerId: k.nasabah, adminId: k.admin, items }),
        (tx: typeof app) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, jumlah: 1 }),
        (tx: typeof app) => koreksi(tx, { originalId: asli, adminId: k.superAdmin }),
      ];
      for (const panggil of panggilan) {
        const e = pgErrorDari(
          await tangkap(app.begin(`isolation level ${level}`, (tx) => panggil(tx as unknown as typeof app))),
        );
        expect(e.message).toBe("ISOLATION_LEVEL_TIDAK_DIDUKUNG");
        // Bukan kode kontrak: salah konfigurasi server, dipetakan ke SERVER_ERROR.
        expect(kodeDariPesanDb(e.message)).toBe("SERVER_ERROR");
      }
    });
  }
});
