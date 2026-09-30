// Satu-satunya sumber URL database untuk tes. Sengaja TIDAK membaca DATABASE_URL*,
// .env, atau .env.local: tes hanya boleh menyentuh Postgres lokal di Docker.

const DEFAULT_OWNER_URL = "postgres://postgres:postgres@localhost:54329/postgres";
const DEFAULT_APP_URL = "postgres://app_server:app_server_test@localhost:54329/postgres";

const HOST_LOKAL = new Set(["localhost", "127.0.0.1"]);
const PORT_LOKAL = "54329";

function pastikanLokal(nama: string, raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${nama} bukan URL yang valid. Tes dibatalkan.`);
  }
  if (!HOST_LOKAL.has(url.hostname) || url.port !== PORT_LOKAL) {
    throw new Error(
      `${nama} harus menunjuk ke Postgres lokal Docker (localhost/127.0.0.1:${PORT_LOKAL}), ` +
        `diterima host=${url.hostname} port=${url.port || "(default)"}. Tes dibatalkan.`,
    );
  }
  return url;
}

export function urlTesDb() {
  const ownerUrl = process.env.TEST_DATABASE_URL_OWNER || DEFAULT_OWNER_URL;
  const appUrl = process.env.TEST_DATABASE_URL_APP || DEFAULT_APP_URL;
  pastikanLokal("TEST_DATABASE_URL_OWNER", ownerUrl);
  const app = pastikanLokal("TEST_DATABASE_URL_APP", appUrl);
  if (decodeURIComponent(app.username) !== "app_server") {
    throw new Error("TEST_DATABASE_URL_APP harus login sebagai app_server. Tes dibatalkan.");
  }
  return { ownerUrl, appUrl, appPassword: decodeURIComponent(app.password) };
}
