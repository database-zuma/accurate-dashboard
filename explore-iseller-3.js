const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check if mart.mv_accurate_summary exists as a materialized view
    console.log('=== Check mart.mv_accurate_summary (matview) ===');
    const mv = await client.query(`
      SELECT schemaname, matviewname 
      FROM pg_matviews 
      WHERE matviewname LIKE '%accurate%' OR matviewname LIKE '%summary%'
    `);
    mv.rows.forEach(r => console.log(`  ${r.schemaname}.${r.matviewname}`));

    // 2. Check all materialized views in mart schema  
    console.log('\n=== All materialized views in mart ===');
    const allMv = await client.query(`
      SELECT schemaname, matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'mart'
    `);
    allMv.rows.forEach(r => console.log(`  ${r.schemaname}.${r.matviewname}`));

    // 3. Get the definition of mv_accurate_summary
    console.log('\n=== mv_accurate_summary DEFINITION ===');
    const mvDef = await client.query(`
      SELECT definition 
      FROM pg_matviews 
      WHERE matviewname = 'mv_accurate_summary'
    `);
    if (mvDef.rows.length > 0) {
      console.log(mvDef.rows[0].definition);
    } else {
      console.log('  NOT FOUND as materialized view');
      
      // Check if it's a regular view
      const vDef = await client.query(`
        SELECT view_definition 
        FROM information_schema.views 
        WHERE table_name = 'mv_accurate_summary'
      `);
      if (vDef.rows.length > 0) {
        console.log('  Found as regular view:');
        console.log(vDef.rows[0].view_definition);
      } else {
        console.log('  NOT FOUND as regular view either');
        
        // Search everywhere
        const everywhere = await client.query(`
          SELECT table_schema, table_name, table_type 
          FROM information_schema.tables 
          WHERE table_name = 'mv_accurate_summary'
        `);
        everywhere.rows.forEach(r => console.log(`  Found: ${r.table_schema}.${r.table_name} (${r.table_type})`));
      }
    }

    // 4. Get columns of mv_accurate_summary from pg_attribute (works for matviews)
    console.log('\n=== mv_accurate_summary COLUMNS (via pg_attribute) ===');
    const cols = await client.query(`
      SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
      JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = 'mv_accurate_summary'
        AND n.nspname = 'mart'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `);
    cols.rows.forEach(r => console.log(`  ${r.attname} (${r.data_type})`));

    // 5. Sample data from mv_accurate_summary
    console.log('\n=== mv_accurate_summary SAMPLE (1 row) ===');
    try {
      const sample = await client.query(`SELECT * FROM mart.mv_accurate_summary LIMIT 1`);
      if (sample.rows.length > 0) {
        Object.entries(sample.rows[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
      }
    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
    }

    // 6. Check if the iseller data is part of mv_accurate_summary
    // The user said "data sales ini kan dari iseller" - check if iseller feeds into this view
    console.log('\n=== Checking if iseller data is in mv_accurate_summary ===');
    try {
      const isellerCheck = await client.query(`
        SELECT source_entity, store_category, COUNT(*) as rows, SUM(pairs) as pairs, SUM(revenue) as revenue
        FROM mart.mv_accurate_summary
        GROUP BY source_entity, store_category
        ORDER BY source_entity, store_category
      `);
      isellerCheck.rows.forEach(r => {
        console.log(`  ${r.source_entity} | ${r.store_category} | rows:${r.rows} | pairs:${r.pairs} | rev:${r.revenue}`);
      });
    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
    }

    // 7. Now check what happens if we look for iseller refunds - where do they show up
    console.log('\n=== core.iseller refund sample with full detail ===');
    const refSample = await client.query(`
      SELECT toko, tanggal_pesanan, nomor_pesanan, produk, sku, article, series, 
             jumlah, harga_asli, jumlah_pengembalian, total_refund_amount, 
             refund_method, status_pembayaran, branch, store_category
      FROM core.iseller
      WHERE jumlah_pengembalian IS NOT NULL 
        AND jumlah_pengembalian != '0' 
        AND jumlah_pengembalian != '0.0'
        AND jumlah_pengembalian != ''
        AND tahun = '2026'
      ORDER BY tanggal_pesanan DESC
      LIMIT 10
    `);
    refSample.rows.forEach((r, i) => {
      console.log(`\n  [${i+1}] ${r.tanggal_pesanan} | ${r.toko} | ${r.produk}`);
      console.log(`      article: ${r.article} | series: ${r.series}`);
      console.log(`      qty: ${r.jumlah} | price: ${r.harga_asli} | refund_qty: ${r.jumlah_pengembalian} | refund_amt: ${r.total_refund_amount}`);
      console.log(`      status: ${r.status_pembayaran} | method: ${r.refund_method}`);
    });

    // 8. Check how mart.iseller_daily is built - does it exclude refunds?
    console.log('\n=== mart.iseller_daily - check if it filters by status_pembayaran ===');
    // Check a refunded order number in mart.iseller_daily
    const refundedOrder = refSample.rows[0]?.nomor_pesanan;
    if (refundedOrder) {
      console.log(`  Checking order ${refundedOrder} in mart.iseller_daily...`);
      // mart.iseller_daily doesn't have nomor_pesanan, check by store+date
      const toko = refSample.rows[0].toko;
      const date = refSample.rows[0].tanggal_pesanan?.toString().substring(0,10);
      const dailyCheck = await client.query(`
        SELECT * FROM mart.iseller_daily 
        WHERE toko = $1 AND sale_date = $2
        LIMIT 5
      `, [toko, date]);
      console.log(`  Found ${dailyCheck.rows.length} rows for ${toko} on ${date}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
