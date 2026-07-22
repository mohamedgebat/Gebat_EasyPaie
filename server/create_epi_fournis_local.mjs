import mysql from 'mysql2/promise';

async function createTableLocal() {
  console.log('Connecting to local MySQL...');
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gebat_easypaie',
    multipleStatements: true
  });

  console.log('Connected! Creating epi_fournis table...');
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS epi_fournis (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ouvrier_id INT NOT NULL,
        equipement VARCHAR(255) NOT NULL,
        prix DECIMAL(10,2) NOT NULL DEFAULT 0,
        date_remise DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ouvrier_id) REFERENCES ouvriers(id) ON DELETE CASCADE
      );
    `);
    console.log('Table epi_fournis created successfully locally!');
  } catch (err) {
    console.error(err);
  }

  await connection.end();
}

createTableLocal().catch(console.error);
