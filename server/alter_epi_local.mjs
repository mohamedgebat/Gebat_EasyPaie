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

  console.log('Connected! Dropping and recreating epi_programmes table...');
  await connection.query(`
    DROP TABLE IF EXISTS epi_programmes;
    CREATE TABLE epi_programmes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ouvrier_id INT NOT NULL,
      semaines_totales INT NOT NULL,
      montant DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ouvrier_id) REFERENCES ouvriers(id) ON DELETE CASCADE
    );
  `);

  console.log('Table epi_programmes altered successfully locally!');
  await connection.end();
}

alterTableLocal().catch(console.error);
