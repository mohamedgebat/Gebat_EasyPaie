import mysql from 'mysql2/promise';

async function main() {
  const publicUrl = 'mysql://root:SWDieKpgktUBNbRQvGEMzfgVmOeJQWUz@hayabusa.proxy.rlwy.net:55550/gebat_easypaie';
  const connection = await mysql.createConnection({
    uri: publicUrl,
    multipleStatements: true
  });
  try {
    console.log('Adding heures_sup column to pointages (Railway)...');
    try {
        await connection.query('ALTER TABLE pointages ADD COLUMN heures_sup DECIMAL(10, 2) DEFAULT 0 AFTER salaire_brut');
        console.log('Successfully added heures_sup column to pointages.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('Column heures_sup already exists in pointages.');
        else console.error('Error adding column to pointages:', err);
    }

    console.log('Adding heures_sup column to paies (Railway)...');
    try {
        await connection.query('ALTER TABLE paies ADD COLUMN heures_sup DECIMAL(10, 2) DEFAULT 0 AFTER salaire_brut');
        console.log('Successfully added heures_sup column to paies.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('Column heures_sup already exists in paies.');
        else console.error('Error adding column to paies:', err);
    }
  } finally {
    await connection.end();
  }
}

main();
