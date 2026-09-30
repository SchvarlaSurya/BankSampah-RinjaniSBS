-- View saldo, immutability ledger, dan konsistensi transaksi <-> item.

-- security_invoker: RLS & hak tabel transactions dicek terhadap role pemanggil,
-- bukan owner view.
CREATE VIEW public.saldo_nasabah WITH (security_invoker = true) AS
SELECT t.customer_id, SUM(t.jumlah)::bigint AS saldo
FROM public.transactions t
GROUP BY t.customer_id;
--> statement-breakpoint
REVOKE ALL ON public.saldo_nasabah FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.saldo_nasabah TO app_server;
--> statement-breakpoint

-- Immutability. Trigger tetap berlaku untuk owner tabel; REVOKE saja tidak cukup.
CREATE FUNCTION public.tolak_perubahan_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat append-only: % tidak diizinkan. Gunakan koreksi() untuk membalik transaksi.',
    TG_TABLE_NAME, TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER transactions_tolak_update_delete
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tolak_perubahan_ledger();
--> statement-breakpoint
CREATE TRIGGER transactions_tolak_truncate
  BEFORE TRUNCATE ON public.transactions
  FOR EACH STATEMENT EXECUTE FUNCTION public.tolak_perubahan_ledger();
--> statement-breakpoint
CREATE TRIGGER transaction_items_tolak_update_delete
  BEFORE UPDATE OR DELETE ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.tolak_perubahan_ledger();
--> statement-breakpoint
CREATE TRIGGER transaction_items_tolak_truncate
  BEFORE TRUNCATE ON public.transaction_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.tolak_perubahan_ledger();
--> statement-breakpoint

-- Dicek saat COMMIT: setor wajib >= 1 item dan SUM(subtotal) = jumlah;
-- tarik & koreksi tidak boleh punya item.
CREATE FUNCTION public.cek_item_transaksi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id bigint;
  v_tipe text;
  v_jumlah integer;
  v_jumlah_item bigint;
  v_total_subtotal bigint;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    v_id := NEW.id;
  ELSE
    v_id := NEW.transaction_id;
  END IF;

  SELECT t.tipe, t.jumlah INTO v_tipe, v_jumlah
  FROM public.transactions t
  WHERE t.id = v_id;

  SELECT count(*), COALESCE(sum(i.subtotal), 0) INTO v_jumlah_item, v_total_subtotal
  FROM public.transaction_items i
  WHERE i.transaction_id = v_id;

  IF v_tipe = 'setor' THEN
    IF v_jumlah_item = 0 THEN
      RAISE EXCEPTION 'Transaksi setor #% tidak punya item.', v_id;
    END IF;
    IF v_total_subtotal <> v_jumlah THEN
      RAISE EXCEPTION 'Transaksi setor #%: jumlah (Rp%) tidak sama dengan total subtotal item (Rp%).',
        v_id, v_jumlah, v_total_subtotal;
    END IF;
  ELSIF v_jumlah_item > 0 THEN
    RAISE EXCEPTION 'Transaksi #% bertipe % tidak boleh punya item.', v_id, v_tipe;
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transactions_cek_item
  AFTER INSERT ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.cek_item_transaksi();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transaction_items_cek_item
  AFTER INSERT ON public.transaction_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.cek_item_transaksi();
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.tolak_perubahan_ledger() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cek_item_transaksi() FROM PUBLIC, anon, authenticated;
