const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check sales_with_product - what feeds into mv_accurate_summary
    console.log('=== sales_with_product view definition ===');
    const swp = await client.query(`
      SELECT view_definition 
      FROM information_schema.views 
      WHERE table_name = 'sales_with_product'
    `);
    if (swp.rows.length > 0) {
      console.log(swp.rows[0].view_definition.substring(0, 2000));
    } else {
      // Check matview
      const swpMv = await client.query(`
        SELECT definition FROM pg_matviews WHERE matviewname = 'sales_with_product'
      `);
      if (swpMv.rows.length > 0) {
        console.log(swpMv.rows[0].definition.substring(0, 2000));
      } else {
        console.log('  NOT FOUND');
      }
    }

    // 2. Check mv_iseller_summary - this might be where iseller data shows up in dashboard
    console.log('\n=== mv_iseller_summary COLUMNS ===');
    const isCols = await client.query(`
      SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
      JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = 'mv_iseller_summary'
        AND n.nspname = 'mart'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `);
    isCols.rows.forEach(r => console.log(`  ${r.attname} (${r.data_type})`));

    // 3. Get mv_iseller_summary definition
    console.log('\n=== mv_iseller_summary DEFINITION ===');
    const isDef = await client.query(`
      SELECT definition FROM pg_matviews WHERE matviewname = 'mv_iseller_summary'
    `);
    if (isDef.rows.length > 0) {
      console.log(isDef.rows[0].definition.substring(0, 3000));
    }

    // 4. Check if there is a sales_with_product view that includes iseller
    console.log('\n=== Does sales_with_product include iseller? ===');
    const swpFull = await client.query(`
      SELECT view_definition 
      FROM information_schema.views 
      WHERE table_name = 'sales_with_product'
    `);
    if (swpFull.rows.length > 0) {
      const def = swpFull.rows[0].view_definition;
      console.log(`  Contains 'iseller': ${def.includes('iseller')}`);
      console.log(`  Contains 'accurate': ${def.includes('accurate')}`);
      console.log(`  Full length: ${def.length}`);
    }

    // 5. Check the dashboard HTML to see what API endpoints it calls
    // Actually let's check the accurate-dashboard route files  
    console.log('\n=== API route files in accurate-dashboard ===');

    // 6. Let's check: does the refunded data in core.iseller end up in mv_accurate_summary?
    // mv_accurate_summary uses sales_with_product which is from Accurate, not iSeller
    // But wait - maybe the user is talking about a different dashboard or endpoint
    
    // 7. Check if iseller data is somehow merged into accurate
    console.log('\n=== Check if sales_with_product has iseller union ===');
    if (swpFull.rows.length > 0) {
      const def = swpFull.rows[0].view_definition;
      // Print first 5000 chars
      console.log(def.substring(0, 5000));
      if (def.length > 5000) {
        console.log('...(truncated)...');
        console.log(def.substring(def.length - 2000));
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
