import mysql from 'mysql2/promise';

// Pool MySQL avec paramètres par défaut (localhost:3306, user: root, password: '', db: gebat_easypaie)
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'gebat_easypaie',
  port: Number(process.env.DB_PORT) || Number(process.env.MYSQLPORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function getCurrentTimestamp() {
  return new Date().toISOString();
}

// Database interface connected to MySQL
const dbInterface = {
  // Ouvriers
  getOuvriers: async () => {
    const [rows] = await pool.query('SELECT * FROM ouvriers ORDER BY id DESC');
    return rows;
  },

  getOuvrier: async (id) => {
    const [rows] = await pool.query('SELECT * FROM ouvriers WHERE id = ?', [id]);
    return rows[0] || null;
  },

  addOuvrier: async (data) => {
    const matricule = data.matricule || `OUV-${Date.now().toString().slice(-4)}`;
    const nom = data.nom || '';
    const prenom = data.prenom || '';
    const telephone = data.telephone || '';
    const site = data.site || 'SONGON';
    const qualification = data.qualification || '';
    const operateur = data.operateur || 'Wave';
    const numero_mobile_money = data.numero_mobile_money || '';
    const statut = data.statut || 'actif';
    const date_entree = data.date_entree || new Date().toISOString().split('T')[0];
    const created_at = getCurrentTimestamp();
    const updated_at = created_at;

    const [res] = await pool.query(
      `INSERT INTO ouvriers (matricule, nom, prenom, telephone, site, qualification, operateur, numero_mobile_money, statut, date_entree, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [matricule, nom, prenom, telephone, site, qualification, operateur, numero_mobile_money, statut, date_entree, created_at, updated_at]
    );

    return { id: res.insertId, ...data, created_at, updated_at };
  },

  updateOuvrier: async (id, data) => {
    const existing = await dbInterface.getOuvrier(id);
    if (!existing) return null;

    const updated_at = getCurrentTimestamp();
    const fields = [];
    const values = [];

    const allowed = [
      'matricule', 'nom', 'prenom', 'telephone', 'site', 'qualification',
      'operateur', 'numero_mobile_money', 'statut', 'epi_settled',
      'epi_refunded', 'epi_departure_option', 'epi_lost_amount',
      'epi_observations', 'date_entree', 'date_depart'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        let val = data[key];
        // Handle empty strings for numeric/boolean columns to prevent MySQL strict mode errors
        if (val === '') {
           if (['epi_lost_amount', 'epi_settled', 'epi_refunded'].includes(key)) val = 0;
           else if (['date_entree', 'date_depart'].includes(key)) val = null;
        }
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('`updated_at` = ?');
    values.push(updated_at);
    values.push(id);

    await pool.query(`UPDATE ouvriers SET ${fields.join(', ')} WHERE id = ?`, values);
    return await dbInterface.getOuvrier(id);
  },

  deleteOuvrier: async (id) => {
    await pool.query('DELETE FROM ouvriers WHERE id = ?', [id]);
  },

  // Pointages
  getPointages: async () => {
    const [rows] = await pool.query(`
      SELECT p.*, o.nom, o.prenom, o.qualification, COALESCE(p.site, o.site) as site
      FROM pointages p
      LEFT JOIN ouvriers o ON p.ouvrier_id = o.id
      ORDER BY p.id DESC
    `);
    return rows;
  },

  addPointage: async (data) => {
    const created_at = getCurrentTimestamp();
    const [res] = await pool.query(
      `INSERT INTO pointages (ouvrier_id, date, salaire_brut, date_debut, date_fin, semaine, site, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.ouvrier_id,
        data.date || null,
        Number(data.salaire_brut) || 0,
        data.date_debut || null,
        data.date_fin || null,
        data.semaine || '',
        data.site || '',
        created_at
      ]
    );
    return { id: res.insertId, ...data, created_at };
  },

  updatePointage: async (id, data) => {
    await pool.query(
      `UPDATE pointages SET salaire_brut = ?, site = ? WHERE id = ?`,
      [Number(data.salaire_brut) || 0, data.site || '', id]
    );
    return { id, ...data };
  },

  deletePointagesBySemaine: async (semaine, site) => {
    let query = 'DELETE FROM pointages WHERE semaine = ?';
    let params = [semaine];
    if (site) {
      query += ' AND site = ?';
      params.push(site);
    }
    const [result] = await pool.query(query, params);
    return result;
  },

  // Ponctions
  getPonctions: async () => {
    const [rows] = await pool.query(`
      SELECT p.*, o.nom, o.prenom
      FROM ponctions p
      LEFT JOIN ouvriers o ON p.ouvrier_id = o.id
      ORDER BY p.id DESC
    `);
    return rows;
  },

  // EPI Programmes
  getEpiProgrammes: async () => {
    const [rows] = await pool.query(`
      SELECT e.*, o.nom, o.prenom 
      FROM epi_programmes e
      LEFT JOIN ouvriers o ON e.ouvrier_id = o.id
      ORDER BY e.id DESC
    `);
    return rows;
  },

  getEpiProgrammesByOuvrier: async (ouvrierId) => {
    const [rows] = await pool.query('SELECT * FROM epi_programmes WHERE ouvrier_id = ?', [ouvrierId]);
    return rows;
  },

  addEpiProgramme: async (data) => {
    const [res] = await pool.query(
      `INSERT INTO epi_programmes (ouvrier_id, semaine, montant) VALUES (?, ?, ?)`,
      [data.ouvrier_id, data.semaine || '', Number(data.montant) || 0]
    );
    return { id: res.insertId, ...data };
  },

  deleteEpiProgramme: async (id) => {
    await pool.query('DELETE FROM epi_programmes WHERE id = ?', [id]);
    return true;
  },

  // EPI Fournis
  getEpiFournis: async () => {
    const [rows] = await pool.query('SELECT * FROM epi_fournis ORDER BY id DESC');
    return rows;
  },

  addEpiFourni: async (data) => {
    const [res] = await pool.query(
      `INSERT INTO epi_fournis (ouvrier_id, equipement, prix, date_remise) VALUES (?, ?, ?, ?)`,
      [data.ouvrier_id, data.equipement, Number(data.prix) || 0, data.date_remise]
    );
    return { id: res.insertId, ...data };
  },

  deleteEpiFourni: async (id) => {
    await pool.query('DELETE FROM epi_fournis WHERE id = ?', [id]);
    return true;
  },

  getPonctionsByOuvrier: async (ouvrierId) => {
    const [rows] = await pool.query('SELECT * FROM ponctions WHERE ouvrier_id = ? ORDER BY id DESC', [ouvrierId]);
    return rows;
  },

  addPonction: async (data) => {
    const montant = Number(data.montant) || 0;
    const [prevRows] = await pool.query(
      'SELECT SUM(montant) as total FROM ponctions WHERE ouvrier_id = ?',
      [data.ouvrier_id]
    );
    const prevTotal = Number(prevRows[0]?.total) || 0;
    const cumul = prevTotal + montant;
    const created_at = getCurrentTimestamp();

    const [res] = await pool.query(
      `INSERT INTO ponctions (ouvrier_id, date, montant, motif, cumul, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.ouvrier_id, data.date || null, montant, data.motif || '', cumul, created_at]
    );
    return { id: res.insertId, ...data, cumul, created_at };
  },

  updatePonction: async (id, data) => {
    const fields = [];
    const values = [];
    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date); }
    if (data.montant !== undefined) { fields.push('montant = ?'); values.push(Number(data.montant) || 0); }
    if (data.motif !== undefined) { fields.push('motif = ?'); values.push(data.motif); }
    
    if (fields.length === 0) return null;
    
    values.push(id);
    await pool.query(`UPDATE ponctions SET ${fields.join(', ')} WHERE id = ?`, values);
    return { id, ...data };
  },

  deletePonction: async (id) => {
    const [res] = await pool.query('DELETE FROM ponctions WHERE id = ?', [id]);
    return res.affectedRows > 0;
  },

  // Loyers
  getLoyers: async () => {
    const [rows] = await pool.query(`
      SELECT l.*, o.nom, o.prenom
      FROM loyers l
      LEFT JOIN ouvriers o ON l.ouvrier_id = o.id
      ORDER BY l.id DESC
    `);
    return rows;
  },

  getLoyersByOuvrier: async (ouvrierId) => {
    const [rows] = await pool.query('SELECT * FROM loyers WHERE ouvrier_id = ?', [ouvrierId]);
    return rows;
  },

  addLoyer: async (data) => {
    const created_at = getCurrentTimestamp();
    const [res] = await pool.query(
      `INSERT INTO loyers (ouvrier_id, mois, annee, montant_mensuel, nombre_tranches, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.ouvrier_id, data.mois || '', data.annee || null, Number(data.montant_mensuel) || 0, Number(data.nombre_tranches) || 1, data.type || 'specifique', created_at]
    );
    return { id: res.insertId, ...data, created_at };
  },

  updateLoyer: async (id, data) => {
    const fields = [];
    const values = [];

    if (data.site !== undefined) { fields.push('site = ?'); values.push(data.site); }
    if (data.qualification !== undefined) { fields.push('qualification = ?'); values.push(data.qualification); }
    if (data.montant_mensuel !== undefined) { fields.push('montant_mensuel = ?'); values.push(Number(data.montant_mensuel) || 0); }
    if (data.nombre_tranches !== undefined) { fields.push('nombre_tranches = ?'); values.push(Number(data.nombre_tranches) || 1); }
    if (data.mois !== undefined) { fields.push('mois = ?'); values.push(data.mois); }
    if (data.annee !== undefined) { fields.push('annee = ?'); values.push(data.annee); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE loyers SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },

  deleteLoyer: async (id) => {
    await pool.query('DELETE FROM loyers WHERE id = ?', [id]);
  },

  // Paiements loyer
  getPaiementsLoyer: async () => {
    const [rows] = await pool.query(`
      SELECT p.*, o.nom, o.prenom
      FROM paiements_loyer p
      LEFT JOIN ouvriers o ON p.ouvrier_id = o.id
      ORDER BY p.id DESC
    `);
    return rows;
  },

  getPaiementsLoyerByOuvrier: async (ouvrierId) => {
    const [rows] = await pool.query('SELECT * FROM paiements_loyer WHERE ouvrier_id = ?', [ouvrierId]);
    return rows;
  },

  addPaiementLoyer: async (data) => {
    const date_paiement = getCurrentTimestamp();
    const [res] = await pool.query(
      `INSERT INTO paiements_loyer (ouvrier_id, mois, annee, montant, date_paiement)
       VALUES (?, ?, ?, ?, ?)`,
      [data.ouvrier_id, data.mois || '', data.annee || null, Number(data.montant) || 0, date_paiement]
    );
    return { id: res.insertId, ...data, date_paiement };
  },

  // Paies
  getPaies: async () => {
    const [rows] = await pool.query(`
      SELECT p.*, o.nom, o.prenom, o.telephone, o.operateur, o.numero_mobile_money
      FROM paies p
      LEFT JOIN ouvriers o ON p.ouvrier_id = o.id
      ORDER BY p.id DESC
    `);
    return rows;
  },

  getPaiesBySemaine: async (semaine) => {
    const [rows] = await pool.query(`
      SELECT p.*, o.nom, o.prenom, o.telephone, o.operateur, o.numero_mobile_money
      FROM paies p
      LEFT JOIN ouvriers o ON p.ouvrier_id = o.id
      WHERE p.semaine = ?
      ORDER BY p.id DESC
    `, [semaine]);
    return rows;
  },

  addPaie: async (data) => {
    const created_at = getCurrentTimestamp();
    const [res] = await pool.query(
      `INSERT INTO paies (ouvrier_id, pointage_id, date_pointage, date, semaine, date_debut, date_fin, salaire_brut, ponction, loyer, epi_remboursement, epi_deduction, total_cotisations_epi, epi_limit, epi_departure_option, net_a_payer, paye, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.ouvrier_id,
        data.pointage_id || null,
        data.date_pointage || null,
        data.date || null,
        data.semaine || '',
        data.date_debut || null,
        data.date_fin || null,
        Number(data.salaire_brut) || 0,
        Number(data.ponction) || 0,
        Number(data.loyer) || 0,
        Number(data.epi_remboursement) || 0,
        Number(data.epi_deduction) || 0,
        Number(data.total_cotisations_epi) || 0,
        Number(data.epi_limit) || 0,
        data.epi_departure_option || '',
        Number(data.net_a_payer) || 0,
        data.paye ? 1 : 0,
        created_at
      ]
    );
    return { id: res.insertId, ...data, created_at };
  },

  updatePaie: async (id, data) => {
    const fields = [];
    const values = [];

    const keys = ['paye', 'net_a_payer', 'ponction', 'loyer', 'salaire_brut'];
    for (const k of keys) {
      if (data[k] !== undefined) {
        fields.push(`\`${k}\` = ?`);
        values.push(k === 'paye' ? (data[k] ? 1 : 0) : data[k]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE paies SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const [rows] = await pool.query('SELECT * FROM paies WHERE id = ?', [id]);
    return rows[0] || null;
  },

  deletePaie: async (id) => {
    await pool.query('DELETE FROM paies WHERE id = ?', [id]);
  },

  deletePaiesBySemaine: async (semaine) => {
    await pool.query('DELETE FROM paies WHERE semaine = ?', [semaine]);
  },

  reloadDatabase: async () => {
    return true;
  },

  // Utilisateurs
  getUtilisateurs: async () => {
    const [rows] = await pool.query('SELECT * FROM utilisateurs ORDER BY id DESC');
    return rows;
  },

  getUtilisateur: async (id) => {
    const [rows] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [id]);
    return rows[0] || null;
  },

  addUtilisateur: async (data) => {
    const username = data.username || '';
    const email = data.email || '';
    const password = data.password || '';
    const titre = data.titre || '';
    const role = data.role || 'Gestionnaire Paie';
    const statut = data.statut || 'actif';
    const created_at = getCurrentTimestamp();
    const updated_at = created_at;

    const [res] = await pool.query(
      `INSERT INTO utilisateurs (username, email, password, titre, role, statut, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, password, titre, role, statut, created_at, updated_at]
    );

    return { id: res.insertId, username, email, titre, role, statut, created_at, updated_at };
  },

  updateUtilisateur: async (id, data) => {
    const existing = await dbInterface.getUtilisateur(id);
    if (!existing) return null;

    const updated_at = getCurrentTimestamp();
    const fields = [];
    const values = [];

    const allowed = ['username', 'email', 'password', 'titre', 'role', 'statut'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`\`${key}\` = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('`updated_at` = ?');
    values.push(updated_at);
    values.push(id);

    await pool.query(`UPDATE utilisateurs SET ${fields.join(', ')} WHERE id = ?`, values);
    return await dbInterface.getUtilisateur(id);
  },

  deleteUtilisateur: async (id) => {
    await pool.query('DELETE FROM utilisateurs WHERE id = ?', [id]);
  },

  // Stats
  getStats: async () => {
    const [[{ ouvriers_actifs }]] = await pool.query("SELECT COUNT(*) as ouvriers_actifs FROM ouvriers WHERE statut = 'actif'");
    const [[{ pointages_semaine }]] = await pool.query("SELECT COUNT(*) as pointages_semaine FROM pointages WHERE created_at >= NOW() - INTERVAL 7 DAY");
    const [[{ ponctions_semaine }]] = await pool.query("SELECT COALESCE(SUM(montant), 0) as ponctions_semaine FROM ponctions WHERE created_at >= NOW() - INTERVAL 7 DAY");
    const [[{ loyers_mois }]] = await pool.query("SELECT COALESCE(SUM(montant), 0) as loyers_mois FROM paiements_loyer WHERE date_paiement >= NOW() - INTERVAL 30 DAY");
    const [[{ total_a_payer }]] = await pool.query("SELECT COALESCE(SUM(net_a_payer), 0) as total_a_payer FROM paies WHERE created_at >= NOW() - INTERVAL 7 DAY");
    const [[{ total_retenues }]] = await pool.query("SELECT COALESCE(SUM(ponction + loyer), 0) as total_retenues FROM paies WHERE created_at >= NOW() - INTERVAL 7 DAY");

    return {
      ouvriers_actifs,
      pointages_semaine,
      ponctions_semaine,
      loyers_mois,
      total_a_payer,
      total_retenues
    };
  },

  resetDatabase: async () => {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');
    await pool.query('TRUNCATE TABLE paies;');
    await pool.query('TRUNCATE TABLE paiements_loyer;');
    await pool.query('TRUNCATE TABLE loyers;');
    await pool.query('TRUNCATE TABLE ponctions;');
    await pool.query('TRUNCATE TABLE pointages;');
    await pool.query('TRUNCATE TABLE ouvriers;');
    await pool.query('TRUNCATE TABLE utilisateurs;');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

    const created_at = getCurrentTimestamp();
    await pool.query(
      `INSERT INTO utilisateurs (username, email, password, titre, role, statut, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@gebat.ci', 'admin123', 'Administrateur Général GEBAT', 'Administrateur', 'actif', created_at, created_at]
    );
  }
};

dbInterface.pool = pool; // Export pool for migration scripts
export default dbInterface;
