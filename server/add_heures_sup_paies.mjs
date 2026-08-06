import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gebat_easypaie'
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Adding heures_sup column to paies...');
    await connection.query('ALTER TABLE paies ADD COLUMN heures_sup DECIMAL(10, 2) DEFAULT 0 AFTER salaire_brut');
    console.log('Successfully added heures_sup column.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column heures_sup already exists in paies.');
    } else {
      console.error('Error adding column to paies:', err);
    }
  } finally {
    await connection.end();
  }
}

main();
