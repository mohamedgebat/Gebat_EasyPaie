import mysql from 'mysql2/promise';

async function addTable() {
  const publicUrl = 'mysql://root:SWDieKpgktUBNbRQvGEMzfgVmOeJQWUz@hayabusa.proxy.rlwy.net:55550/gebat_easypaie';
  
  console.log('Connecting to remote Railway MySQL...');
  const connection = await mysql.createConnection({
    uri: publicUrl
  });

  console.log('Connected! Creating epi_programmes table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS epi_programmes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ouvrier_id INT NOT NULL,
      semaine VARCHAR(50) NOT NULL,
      montant DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ouvrier_id) REFERENCES ouvriers(id) ON DELETE CASCADE
    );
  `);

  console.log('Table epi_programmes created successfully!');
  await connection.end();
}

addTable().catch(console.error);
