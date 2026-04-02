const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://openclaw_app:Zuma-0psCl4w-2026!@76.13.194.120:5432/openclaw_ops',
  max: 3,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check columns of raw.iseller_sales
    console.log('=== raw.iseller_sales COLUMNS ===');
    const cols1 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='raw' AND table_name='iseller_sales'
      ORDER BY ordinal_position
    `);
    cols1.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 2. Check columns of raw.iseller_2026
    console.log('\n=== raw.iseller_2026 COLUMNS ===');
    const cols2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='raw' AND table_name='iseller_2026'
      ORDER BY ordinal_position
    `);
    cols2.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 3. Check columns of raw.iseller_returns_by_store
    console.log('\n=== raw.iseller_returns_by_store COLUMNS ===');
    const cols3 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='raw' AND table_name='iseller_returns_by_store'
      ORDER BY ordinal_position
    `);
    cols3.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 4. Check columns of core.iseller
    console.log('\n=== core.iseller COLUMNS ===');
    const cols4 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='core' AND table_name='iseller'
      ORDER BY ordinal_position
    `);
    cols4.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 5. Check columns of mart.iseller_txn
    console.log('\n=== mart.iseller_txn COLUMNS ===');
    const cols5 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='mart' AND table_name='iseller_txn'
      ORDER BY ordinal_position
    `);
    cols5.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 6. Check mart.iseller_daily columns
    console.log('\n=== mart.iseller_daily COLUMNS ===');
    const cols6 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='mart' AND table_name='iseller_daily'
      ORDER BY ordinal_position
    `);
    cols6.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 7. Sample data from raw.iseller_sales - look for refund columns
    console.log('\n=== raw.iseller_sales SAMPLE (1 row) ===');
    const sample1 = await client.query(`SELECT * FROM raw.iseller_sales LIMIT 1`);
    if (sample1.rows.length > 0) {
      Object.entries(sample1.rows[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
    }

    // 8. Sample from raw.iseller_2026
    console.log('\n=== raw.iseller_2026 SAMPLE (1 row) ===');
    const sample2 = await client.query(`SELECT * FROM raw.iseller_2026 LIMIT 1`);
    if (sample2.rows.length > 0) {
      Object.entries(sample2.rows[0]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
    }

    // 9. Search for columns containing "pengembalian" or "return" or "refund" across ALL tables
    console.log('\n=== COLUMNS with "pengembalian" or "return" or "refund" ===');
    const refundCols = await client.query(`
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE (
        column_name ILIKE '%pengembalian%' 
        OR column_name ILIKE '%return%' 
        OR column_name ILIKE '%refund%'
        OR column_name ILIKE '%retur%'
      )
      AND table_schema IN ('raw', 'mart', 'core', 'public')
      ORDER BY table_schema, table_name, ordinal_position
    `);
    refundCols.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}.${r.column_name} (${r.data_type})`));

    // 10. Check what the current sales detail API uses - look at mv_accurate_summary
    console.log('\n=== mart.mv_accurate_summary COLUMNS ===');
    const cols7 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='mart' AND table_name='mv_accurate_summary'
      ORDER BY ordinal_position
    `);
    cols7.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
