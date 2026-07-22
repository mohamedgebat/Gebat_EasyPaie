import mysql from 'mysql2/promise';

async function alterTableLocal() {
  console.log('Connecting to local MySQL...');
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gebat_easypaie',
    multipleStatements: true
  });

  console.log('Connected! Adding semaines_exclues to epi_programmes table...');
  try {
    await connection.query(`
      ALTER TABLE epi_programmes ADD COLUMN semaines_exclues VARCHAR(255) DEFAULT '';
    `);
    console.log('Column added successfully locally!');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists.');
    } else {
      console.error(err);
    }
  }

  await connection.end();
}

alterTableLocal().catch(console.error);
