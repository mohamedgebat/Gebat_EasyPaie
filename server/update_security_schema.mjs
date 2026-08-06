import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'hayabusa.proxy.rlwy.net',
  port: Number(process.env.DB_PORT) || 55550,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'SWDieKpgktUBNbRQvGEMzfgVmOeJQWUz',
  database: process.env.DB_NAME || 'gebat_easypaie',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function main() {
  try {
    console.log('Ajout de must_change_password à utilisateurs...');
    await pool.query(`
      ALTER TABLE utilisateurs 
      ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE;
    `).catch(err => {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      console.log('La colonne must_change_password existe déjà.');
    });

    console.log('Mise à jour des utilisateurs existants pour forcer le changement de mot de passe...');
    await pool.query(`UPDATE utilisateurs SET must_change_password = TRUE`);

    console.log('Création de la table audit_logs...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        username VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Migration sécurité terminée avec succès.');
  } catch (err) {
    console.error('Erreur lors de la migration:', err);
  } finally {
    process.exit(0);
  }
}

main();
