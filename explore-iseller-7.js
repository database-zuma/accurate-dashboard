const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Does mart.iseller_daily include refunded rows?
    // Check by looking at the definition
    console.log('=== mart.iseller_daily DEFINITION ===');
    const def = await client.query(`SELECT definition FROM pg_matviews WHERE matviewname = 'iseller_daily'`);
    if (def.rows.length > 0) {
      console.log(def.rows[0].definition);
    } else {
      // check regular view
      const vdef = await client.query(`SELECT view_definition FROM information_schema.views WHERE table_name = 'iseller_daily'`);
      if (vdef.rows.length > 0) console.log(vdef.rows[0].view_definition);
      else console.log('  Not a view either, checking table...');
    }

    // 2. Check core.iseller: how many rows are refunded vs normal
    console.log('\n=== core.iseller status_pembayaran breakdown ===');
    const statusBreak = await client.query(`
      SELECT status_pembayaran, COUNT(*) as cnt, 
             SUM(CAST(NULLIF(jumlah,'') AS numeric)) as total_qty,
             SUM(CAST(NULLIF(harga_asli,'') AS numeric)) as total_harga
      FROM core.iseller
      WHERE tahun = '2026'
      GROUP BY status_pembayaran
      ORDER BY cnt DESC
    `);
    statusBreak.rows.forEach(r => {
      console.log(`  ${r.status_pembayaran}: ${r.cnt} rows | qty: ${r.total_qty} | harga: ${r.total_harga}`);
    });

    // 3. For refunded rows specifically - what does jumlah vs jumlah_pengembalian look like?
    console.log('\n=== Refunded rows: jumlah vs jumlah_pengembalian (2026) ===');
    const refDetail = await client.query(`
      SELECT 
        SUM(CAST(NULLIF(jumlah,'') AS numeric)) as sum_jumlah,
        SUM(CAST(NULLIF(jumlah_pengembalian,'') AS numeric)) as sum_pengembalian,
        SUM(CAST(NULLIF(harga_asli,'') AS numeric)) as sum_harga_asli,
        SUM(CAST(NULLIF(total_refund_amount,'') AS numeric)) as sum_refund_amount,
        COUNT(*) as row_count
      FROM core.iseller
      WHERE status_pembayaran = 'refunded'
        AND tahun = '2026'
    `);
    const r = refDetail.rows[0];
    console.log(`  Refunded rows: ${r.row_count}`);
    console.log(`  sum(jumlah): ${r.sum_jumlah} (original sale qty)`);
    console.log(`  sum(jumlah_pengembalian): ${r.sum_pengembalian} (returned qty)`);
    console.log(`  sum(harga_asli): ${r.sum_harga_asli} (original price)`);
    console.log(`  sum(total_refund_amount): ${r.sum_refund_amount} (refund amount)`);

    // 4. Check: are refunded rows ALSO in mart.iseller_daily?
    // Pick a known refunded order and check
    console.log('\n=== Check if refunded orders appear in mart.iseller_daily ===');
    const refOrder = await client.query(`
      SELECT toko, tanggal_pesanan::date as d, sku, 
             CAST(NULLIF(jumlah,'') AS numeric) as qty,
             CAST(NULLIF(jumlah_pengembalian,'') AS numeric) as refund_qty
      FROM core.iseller
      WHERE status_pembayaran = 'refunded' AND tahun = '2026'
      LIMIT 3
    `);
    for (const ro of refOrder.rows) {
      const daily = await client.query(`
        SELECT toko, sale_date, pairs, revenue, produk
        FROM mart.iseller_daily
        WHERE toko = $1 AND sale_date = $2
        LIMIT 5
      `, [ro.toko, ro.d]);
      console.log(`\n  Refunded: ${ro.toko} | ${ro.d} | ${ro.sku} | qty:${ro.qty} | refund:${ro.refund_qty}`);
      console.log(`  In iseller_daily for same store+date: ${daily.rows.length} rows`);
      if (daily.rows.length > 0) {
        daily.rows.forEach(d => console.log(`    ${d.produk} | pairs:${d.pairs} | rev:${d.revenue}`));
      }
    }

    // 5. The real question: how does mart.iseller_daily filter?
    // Check if it has a WHERE clause filtering out refunded status
    console.log('\n=== How is mart.iseller_daily built? ===');
    // It's a TABLE not a view/matview - check if there's a known ETL script
    const tableCheck = await client.query(`
      SELECT table_type FROM information_schema.tables 
      WHERE table_schema='mart' AND table_name='iseller_daily'
    `);
    console.log(`  Type: ${tableCheck.rows[0]?.table_type}`);

    // 6. Directly count: does iseller_daily have the same total as core.iseller minus refunds?
    console.log('\n=== Pair count comparison (2026) ===');
    const coreTotal = await client.query(`
      SELECT 
        SUM(CAST(NULLIF(jumlah,'') AS numeric)) as total_qty,
        SUM(CASE WHEN status_pembayaran != 'refunded' THEN CAST(NULLIF(jumlah,'') AS numeric) ELSE 0 END) as non_refund_qty,
        SUM(CASE WHEN status_pembayaran = 'refunded' THEN CAST(NULLIF(jumlah,'') AS numeric) ELSE 0 END) as refund_qty
      FROM core.iseller
      WHERE tahun = '2026'
        AND store_category = 'RETAIL'
    `);
    const dailyTotal = await client.query(`
      SELECT SUM(pairs) as total_pairs
      FROM mart.iseller_daily
      WHERE sale_date >= '2026-01-01'
        AND store_category = 'RETAIL'
    `);
    console.log(`  core.iseller RETAIL 2026:`);
    console.log(`    total jumlah: ${coreTotal.rows[0].total_qty}`);
    console.log(`    non-refund jumlah: ${coreTotal.rows[0].non_refund_qty}`);
    console.log(`    refund jumlah: ${coreTotal.rows[0].refund_qty}`);
    console.log(`  mart.iseller_daily RETAIL 2026:`);
    console.log(`    total pairs: ${dailyTotal.rows[0].total_pairs}`);

    // 7. Quick summary of refund articles for 2026
    console.log('\n=== Top refunded articles (2026, RETAIL) ===');
    const topRefund = await client.query(`
      SELECT article, series, 
             COUNT(*) as refund_count,
             SUM(CAST(NULLIF(jumlah_pengembalian,'') AS numeric)) as refund_qty,
             SUM(CAST(NULLIF(total_refund_amount,'') AS numeric)) as refund_value
      FROM core.iseller
      WHERE status_pembayaran = 'refunded'
        AND tahun = '2026'
        AND store_category = 'RETAIL'
        AND article IS NOT NULL
      GROUP BY article, series
      ORDER BY refund_qty DESC
      LIMIT 10
    `);
    topRefund.rows.forEach(r => {
      console.log(`  ${r.article} (${r.series}) | count:${r.refund_count} | qty:${r.refund_qty} | value:${r.refund_value}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
