import mysql from 'mysql2/promise';

async function alterTable() {
  const publicUrl = 'mysql://root:SWDieKpgktUBNbRQvGEMzfgVmOeJQWUz@hayabusa.proxy.rlwy.net:55550/gebat_easypaie';
  
  console.log('Connecting to remote Railway MySQL...');
  const connection = await mysql.createConnection({
    uri: publicUrl,
    multipleStatements: true
  });

  console.log('Altering epi_programmes table to add semaine column...');
  try {
    await connection.query(`
      ALTER TABLE epi_programmes ADD COLUMN semaine VARCHAR(50) DEFAULT '';
    `);
    console.log('Table epi_programmes altered successfully (added semaine)!');
  } catch(e) {
    console.log('Column semaine might already exist:', e.message);
  }

  await connection.end();
}

alterTable().catch(console.error);
