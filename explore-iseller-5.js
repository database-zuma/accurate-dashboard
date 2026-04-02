const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Get the FULL definition chain: sales_with_product -> what base table?
    console.log('=== sales_with_product base definition ===');
    // It's a view wrapping another view - let's find the full chain
    const swp = await client.query(`
      SELECT schemaname, viewname, definition 
      FROM pg_views 
      WHERE viewname = 'sales_with_product'
    `);
    if (swp.rows.length > 0) {
      console.log(`Schema: ${swp.rows[0].schemaname}`);
      console.log(`Definition (first 500 chars): ${swp.rows[0].definition.substring(0, 500)}`);
    }

    // Check pg_matviews too
    const swpMv = await client.query(`
      SELECT schemaname, matviewname, definition 
      FROM pg_matviews 
      WHERE matviewname = 'sales_with_product'
    `);
    if (swpMv.rows.length > 0) {
      console.log('\nFound as materialized view:');
      console.log(`Schema: ${swpMv.rows[0].schemaname}`);
      console.log(`Definition: ${swpMv.rows[0].definition.substring(0, 3000)}`);
    }

    // 2. The key question: Does the iSeller data come from the Accurate flow or separately?
    // The sales_with_product view maps to accurate sales. But the user says "dari iseller."
    // Let's check: does mv_accurate_summary really include iSeller data?
    console.log('\n=== Check if any iSeller stores appear in mv_accurate_summary ===');
    const iSellerStores = await client.query(`
      SELECT DISTINCT toko 
      FROM mart.mv_accurate_summary 
      WHERE store_category = 'RETAIL' 
        AND toko ILIKE '%zuma%'
      ORDER BY toko
      LIMIT 20
    `);
    console.log('Stores in mv_accurate_summary (RETAIL):');
    iSellerStores.rows.forEach(r => console.log(`  ${r.toko}`));

    // 3. Now check iSeller daily stores
    console.log('\n=== Stores in mart.iseller_daily ===');
    const iSellerDailyStores = await client.query(`
      SELECT DISTINCT toko 
      FROM mart.iseller_daily 
      WHERE toko ILIKE '%zuma%'
      ORDER BY toko
      LIMIT 20
    `);
    console.log('Stores in iseller_daily:');
    iSellerDailyStores.rows.forEach(r => console.log(`  ${r.toko}`));

    // 4. Critical: Check the aggregate endpoint - it queries raw.accurate_sales_ddd 
    // + raw.iseller_returns_by_store. The DETAIL endpoint queries mv_accurate_summary.
    // Are these the same data? Or is the sales detail using Accurate while aggregate uses returns from iSeller?
    
    // 5. Check raw.accurate_sales_ddd columns vs what is in mv_accurate_summary
    console.log('\n=== raw.accurate_sales_ddd sample ===');
    const accSample = await client.query(`
      SELECT * FROM raw.accurate_sales_ddd LIMIT 1
    `);
    if (accSample.rows.length > 0) {
      Object.entries(accSample.rows[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
    }

    // 6. The real question: is the Accurate data the SAME as iSeller data, or different?
    // iSeller = POS system (retail stores). Accurate = accounting system.
    // Both record the same sales but from different sources.
    // The user says "data sales ini dari iseller" - maybe the pipeline feeds iSeller into accurate?
    // Or maybe the dashboard section they're looking at uses a different endpoint?
    
    // Check: do the sales numbers match between accurate and iseller for same store/date?
    console.log('\n=== Compare Accurate vs iSeller for a recent date ===');
    const comparison = await client.query(`
      WITH acc AS (
        SELECT '2026-03-01'::date as d, 
               SUM(pairs) as acc_pairs, SUM(revenue) as acc_rev
        FROM mart.mv_accurate_summary
        WHERE sale_date = '2026-03-01' AND store_category = 'RETAIL'
      ),
      isl AS (
        SELECT '2026-03-01'::date as d,
               SUM(pairs) as isl_pairs, SUM(revenue) as isl_rev
        FROM mart.iseller_daily
        WHERE sale_date = '2026-03-01' AND store_category = 'RETAIL'
      )
      SELECT acc.acc_pairs, acc.acc_rev, isl.isl_pairs, isl.isl_rev
      FROM acc, isl
    `);
    if (comparison.rows.length > 0) {
      const r = comparison.rows[0];
      console.log(`  Accurate: ${r.acc_pairs} pairs, Rp ${r.acc_rev}`);
      console.log(`  iSeller:  ${r.isl_pairs} pairs, Rp ${r.isl_rev}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
