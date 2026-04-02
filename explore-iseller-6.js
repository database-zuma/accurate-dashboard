const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check for negative quantities in mv_accurate_summary (returns/refunds in Accurate)
    console.log('=== Negative pairs in mv_accurate_summary ===');
    const negPairs = await client.query(`
      SELECT COUNT(*) as cnt, 
             SUM(pairs) as total_neg_pairs, 
             SUM(revenue) as total_neg_rev
      FROM mart.mv_accurate_summary 
      WHERE pairs < 0
    `);
    console.log(`  Rows with negative pairs: ${negPairs.rows[0].cnt}`);
    console.log(`  Total negative pairs: ${negPairs.rows[0].total_neg_pairs}`);
    console.log(`  Total negative revenue: ${negPairs.rows[0].total_neg_rev}`);

    // 2. Sample negative rows
    console.log('\n=== Sample negative-qty rows ===');
    const negSample = await client.query(`
      SELECT sale_date, toko, article, series, pairs, revenue, source_entity, store_category
      FROM mart.mv_accurate_summary 
      WHERE pairs < 0
      ORDER BY sale_date DESC
      LIMIT 10
    `);
    negSample.rows.forEach((r, i) => {
      console.log(`  [${i+1}] ${r.sale_date} | ${r.toko} | ${r.article} | pairs:${r.pairs} | rev:${r.revenue} | ${r.source_entity}/${r.store_category}`);
    });

    // 3. Check negative revenue (return might have positive qty but negative revenue)
    console.log('\n=== Negative revenue in mv_accurate_summary ===');
    const negRev = await client.query(`
      SELECT COUNT(*) as cnt,
             SUM(revenue) as total_neg_rev
      FROM mart.mv_accurate_summary 
      WHERE revenue < 0
    `);
    console.log(`  Rows with negative revenue: ${negRev.rows[0].cnt}`);
    console.log(`  Total negative revenue: ${negRev.rows[0].total_neg_rev}`);

    // 4. Check what "sales_with_product" really refers to  
    // Look for the actual base query that contains the FROM clause
    console.log('\n=== Finding the real sales_with_product definition ===');
    // Check if it's a view chain
    const viewDeps = await client.query(`
      SELECT dependent_ns.nspname as dependent_schema,
             dependent_view.relname as dependent_view,
             source_ns.nspname as source_schema,
             source_table.relname as source_table
      FROM pg_depend 
      JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
      JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
      JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
      JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
      JOIN pg_namespace source_ns ON source_table.relnamespace = source_ns.oid
      WHERE dependent_view.relname = 'sales_with_product'
      AND source_table.relname != 'sales_with_product'
      AND pg_depend.deptype = 'n'
    `);
    console.log('  Dependencies of sales_with_product:');
    viewDeps.rows.forEach(r => console.log(`    ${r.source_schema}.${r.source_table}`));

    // 5. Check accurate_sales_ddd for negative quantities (returns in Accurate)
    console.log('\n=== Negative quantities in raw.accurate_sales_ddd ===');
    const accNeg = await client.query(`
      SELECT COUNT(*) as cnt, SUM(kuantitas) as neg_qty, SUM(total_harga) as neg_total
      FROM raw.accurate_sales_ddd
      WHERE kuantitas < 0
    `);
    console.log(`  Rows with negative qty: ${accNeg.rows[0].cnt}`);
    console.log(`  Total negative qty: ${accNeg.rows[0].neg_qty}`);
    console.log(`  Total negative total_harga: ${accNeg.rows[0].neg_total}`);

    // 6. Sample negative qty from accurate_sales_ddd
    if (parseInt(accNeg.rows[0].cnt) > 0) {
      console.log('\n=== Sample negative rows in accurate_sales_ddd ===');
      const accNegSample = await client.query(`
        SELECT tanggal, nama_departemen, nama_barang, kuantitas, total_harga, nomor_invoice
        FROM raw.accurate_sales_ddd
        WHERE kuantitas < 0
        ORDER BY tanggal DESC
        LIMIT 5
      `);
      accNegSample.rows.forEach((r, i) => {
        console.log(`  [${i+1}] ${r.tanggal} | ${r.nama_departemen} | ${r.nama_barang} | qty:${r.kuantitas} | total:${r.total_harga}`);
      });
    }

    // 7. Check same for MBB
    console.log('\n=== Negative quantities in raw.accurate_sales_mbb ===');
    const mbbNeg = await client.query(`
      SELECT COUNT(*) as cnt, SUM(kuantitas) as neg_qty, SUM(total_harga) as neg_total
      FROM raw.accurate_sales_mbb
      WHERE kuantitas < 0
    `);
    console.log(`  Rows with negative qty: ${mbbNeg.rows[0].cnt}`);
    console.log(`  Total negative qty: ${mbbNeg.rows[0].neg_qty}`);
    console.log(`  Total negative total_harga: ${mbbNeg.rows[0].neg_total}`);

    // 8. Summary of impact
    console.log('\n=== IMPACT SUMMARY ===');
    const totalSales = await client.query(`
      SELECT SUM(pairs) as total_pairs, SUM(revenue) as total_revenue
      FROM mart.mv_accurate_summary
      WHERE store_category = 'RETAIL'
    `);
    console.log(`  Total RETAIL pairs: ${totalSales.rows[0].total_pairs}`);
    console.log(`  Total RETAIL revenue: ${totalSales.rows[0].total_revenue}`);
    console.log(`  Negative pairs included: ${negPairs.rows[0].total_neg_pairs}`);
    console.log(`  Negative revenue included: ${negRev.rows[0].total_neg_rev}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
