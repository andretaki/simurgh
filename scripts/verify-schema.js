const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function verifySchema() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    // Check if tables exist in simurgh schema
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'simurgh'
      ORDER BY table_name
    `;
    
    console.log('Tables in simurgh schema:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Count rows in each table
    for (const table of tables) {
      const count = await sql`
        SELECT COUNT(*) as count 
        FROM simurgh.${sql(table.table_name)}
      `;
      console.log(`    Rows in ${table.table_name}: ${count[0].count}`);
    }
    
    console.log('\n✅ Schema verification complete!');
    
  } catch (error) {
    console.error('Error verifying schema:', error);
  } finally {
    await sql.end();
  }
}

verifySchema();