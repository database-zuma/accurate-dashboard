const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Find rows with actual refund data in core.iseller
    console.log('=== core.iseller rows WHERE jumlah_pengembalian IS NOT NULL (5 samples) ===');
    const refunds1 = await client.query(`
      SELECT nomor_pesanan, tanggal_pesanan, toko, produk, sku, 
             jumlah, harga_asli, jumlah_pengembalian, total_refund_amount, refund_method,
             jumlah_pembayaran, status_pembayaran, article, series, branch, store_category
      FROM core.iseller 
      WHERE jumlah_pengembalian IS NOT NULL 
        AND jumlah_pengembalian != '0' 
        AND jumlah_pengembalian != '0.0'
        AND jumlah_pengembalian != ''
      LIMIT 5
    `);
    refunds1.rows.forEach((r, i) => {
      console.log(`\n  --- Row ${i+1} ---`);
      Object.entries(r).forEach(([k,v]) => console.log(`    ${k}: ${v}`));
    });

    // 2. Count refund rows vs total rows
    console.log('\n=== REFUND STATS in core.iseller ===');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(CASE WHEN jumlah_pengembalian IS NOT NULL 
                    AND jumlah_pengembalian != '0' 
                    AND jumlah_pengembalian != '0.0'
                    AND jumlah_pengembalian != '' THEN 1 END) as refund_rows,
        COUNT(CASE WHEN total_refund_amount IS NOT NULL 
                    AND total_refund_amount != '0' 
                    AND total_refund_amount != '0.0'
                    AND total_refund_amount != '' THEN 1 END) as refund_amount_rows,
        COUNT(CASE WHEN refund_method IS NOT NULL 
                    AND refund_method != '' THEN 1 END) as has_refund_method
      FROM core.iseller
    `);
    console.log(`  Total rows: ${stats.rows[0].total_rows}`);
    console.log(`  Rows with jumlah_pengembalian: ${stats.rows[0].refund_rows}`);
    console.log(`  Rows with total_refund_amount: ${stats.rows[0].refund_amount_rows}`);
    console.log(`  Rows with refund_method: ${stats.rows[0].has_refund_method}`);

    // 3. Check what mart.iseller_daily does - does it include/exclude refunds?
    console.log('\n=== mart.iseller_daily - check if refunds are separate ===');
    const dailyCheck = await client.query(`
      SELECT sale_date, toko, article, pairs, revenue, discount
      FROM mart.iseller_daily
      WHERE pairs < 0
      LIMIT 5
    `);
    console.log(`  Rows with negative pairs (possible refunds): ${dailyCheck.rows.length}`);
    dailyCheck.rows.forEach((r, i) => {
      console.log(`  Row ${i+1}: ${r.sale_date} | ${r.toko} | ${r.article} | pairs:${r.pairs} | rev:${r.revenue}`);
    });

    // 4. What does the current sales detail route query? Check mv_accurate_summary 
    console.log('\n=== mart.mv_accurate_summary existence check ===');
    const mvCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM information_schema.columns 
      WHERE table_schema='mart' AND table_name='mv_accurate_summary'
    `);
    console.log(`  Columns in mv_accurate_summary: ${mvCheck.rows[0].cnt}`);
    
    if (mvCheck.rows[0].cnt == 0) {
      // It might be a view - check views
      const viewCheck = await client.query(`
        SELECT table_schema, table_name, table_type 
        FROM information_schema.tables 
        WHERE table_name LIKE '%accurate%' OR table_name LIKE '%summary%'
        ORDER BY table_schema, table_name
      `);
      console.log('  Tables/views matching *accurate* or *summary*:');
      viewCheck.rows.forEach(r => console.log(`    ${r.table_schema}.${r.table_name} (${r.table_type})`));
    }

    // 5. Check what the sales detail API route actually queries
    // Look for the source table - it uses mart.mv_accurate_summary or similar
    console.log('\n=== Check available mart views/tables ===');
    const marts = await client.query(`
      SELECT table_schema, table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'mart'
      ORDER BY table_name
    `);
    marts.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name} (${r.table_type})`));

    // 6. Refund values breakdown from core.iseller  
    console.log('\n=== REFUND VALUES BREAKDOWN (core.iseller) ===');
    const refundBreakdown = await client.query(`
      SELECT 
        tahun,
        COUNT(*) as refund_line_items,
        SUM(CAST(NULLIF(jumlah_pengembalian,'') AS numeric)) as total_refund_qty,
        SUM(CAST(NULLIF(total_refund_amount,'') AS numeric)) as total_refund_value
      FROM core.iseller
      WHERE jumlah_pengembalian IS NOT NULL 
        AND jumlah_pengembalian != '0' 
        AND jumlah_pengembalian != '0.0'
        AND jumlah_pengembalian != ''
      GROUP BY tahun
      ORDER BY tahun
    `);
    refundBreakdown.rows.forEach(r => {
      console.log(`  ${r.tahun}: ${r.refund_line_items} items, qty=${r.total_refund_qty}, value=${r.total_refund_value}`);
    });

    // 7. Check how the current route.ts queries data - look at the sales detail route
    console.log('\n=== What does mart.iseller_daily query look like for refund? ===');
    const dailyAgg = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        SUM(pairs) as total_pairs,
        SUM(revenue) as total_revenue,
        SUM(CASE WHEN pairs < 0 THEN pairs ELSE 0 END) as negative_pairs,
        SUM(CASE WHEN revenue < 0 THEN revenue ELSE 0 END) as negative_revenue
      FROM mart.iseller_daily
    `);
    console.log(`  Total rows: ${dailyAgg.rows[0].total_rows}`);
    console.log(`  Total pairs: ${dailyAgg.rows[0].total_pairs}`);
    console.log(`  Total revenue: ${dailyAgg.rows[0].total_revenue}`);
    console.log(`  Negative pairs (refunds?): ${dailyAgg.rows[0].negative_pairs}`);
    console.log(`  Negative revenue (refunds?): ${dailyAgg.rows[0].negative_revenue}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
