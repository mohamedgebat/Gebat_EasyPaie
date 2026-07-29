import mysql from 'mysql2/promise';

async function fixSiteTypo() {
  const publicUrl = 'mysql://root:SWDieKpgktUBNbRQvGEMzfgVmOeJQWUz@hayabusa.proxy.rlwy.net:55550/gebat_easypaie';
  
  console.log('Connecting to remote Railway MySQL...');
  const connection = await mysql.createConnection({
    uri: publicUrl
  });

  console.log('Connected! Fixing SONON to SONGON in ouvriers table...');
  const [result1] = await connection.query("UPDATE ouvriers SET site = 'SONGON' WHERE site = 'SONON' OR site = 'SONON ' OR site = ' SONON'");
  console.log(`ouvriers updated: ${result1.affectedRows} rows affected.`);

  console.log('Fixing SONON to SONGON in pointages table...');
  const [result2] = await connection.query("UPDATE pointages SET site = 'SONGON' WHERE site = 'SONON'");
  console.log(`pointages updated: ${result2.affectedRows} rows affected.`);

  console.log('Fixing SONON to SONGON in paies table...');
  const [result3] = await connection.query("UPDATE paies SET site = 'SONGON' WHERE site = 'SONON'");
  console.log(`paies updated: ${result3.affectedRows} rows affected.`);

  console.log('Done!');
  await connection.end();
}

fixSiteTypo().catch(console.error);
