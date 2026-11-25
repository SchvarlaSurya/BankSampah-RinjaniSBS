CREATE TABLE "admin_login_day" (
	"user_id" text,
	"login_date" date,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "admin_login_day_pkey" PRIMARY KEY("user_id","login_date"),
	CONSTRAINT "admin_login_day_count_positif" CHECK ("count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "admin_presence" (
	"user_id" text PRIMARY KEY,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"online_since" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_keepalive" (
	"id" smallint PRIMARY KEY DEFAULT 1,
	"last_ping_at" timestamp with time zone DEFAULT now() NOT NULL,
	"jumlah_ping" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "system_keepalive_satu_baris" CHECK ("id" = 1)
);
--> statement-breakpoint
ALTER TABLE "admin_login_day" ADD CONSTRAINT "admin_login_day_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "admin_presence" ADD CONSTRAINT "admin_presence_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;