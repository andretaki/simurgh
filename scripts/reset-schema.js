const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function resetSchema() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    // Drop all tables in simurgh schema
    await sql`DROP SCHEMA IF EXISTS simurgh CASCADE`;
    console.log('✓ Dropped simurgh schema and all its tables');
    
    // Recreate empty schema
    await sql`CREATE SCHEMA simurgh`;
    console.log('✓ Created empty simurgh schema');
    
    console.log('\n✅ Schema reset complete! Now run: npm run db:push');
    
  } catch (error) {
    console.error('Error resetting schema:', error);
  } finally {
    await sql.end();
  }
}

resetSchema();