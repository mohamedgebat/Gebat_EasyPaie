import express from 'express';
import cors from 'cors';
import db from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ouvriers routes
app.get('/api/ouvriers', async (req, res) => {
  try {
    const ouvriers = await db.getOuvriers();
    res.json(ouvriers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ouvriers/:id', async (req, res) => {
  try {
    const ouvrier = await db.getOuvrier(parseInt(req.params.id));
    if (ouvrier) {
      res.json(ouvrier);
    } else {
      res.status(404).json({ error: 'Ouvrier not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ouvriers', async (req, res) => {
  try {
    const { matricule, nom, prenom, telephone, site, qualification, operateur, numero_mobile_money, date_entree, statut } = req.body;
    const result = await db.addOuvrier({ matricule, nom, prenom, telephone, site, qualification, operateur, numero_mobile_money, date_entree, statut });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ouvriers/:id', async (req, res) => {
  try {
    const result = await db.updateOuvrier(parseInt(req.params.id), req.body);
    res.json(result || { id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ouvriers/:id', async (req, res) => {
  try {
    await db.deleteOuvrier(parseInt(req.params.id));
    res.json({ message: 'Ouvrier deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pointages routes
app.get('/api/pointages', async (req, res) => {
  try {
    const pointages = await db.getPointages();
    res.json(pointages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pointages', async (req, res) => {
  try {
    const { ouvrier_id, date, salaire_brut, date_debut, date_fin, semaine, site } = req.body;
    const result = await db.addPointage({ 
      ouvrier_id: parseInt(ouvrier_id), 
      date, 
      salaire_brut: Number(salaire_brut) || 0,
      date_debut: date_debut || null,
      date_fin: date_fin || null,
      semaine: semaine || '',
      site: site || ''
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ponctions routes
app.get('/api/ponctions', async (req, res) => {
  try {
    const ponctions = await db.getPonctions();
    res.json(ponctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ponctions/ouvrier/:ouvrierId', async (req, res) => {
  try {
    const ponctions = await db.getPonctionsByOuvrier(parseInt(req.params.ouvrierId));
    res.json(ponctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ponctions', async (req, res) => {
  try {
    const { ouvrier_id, date, montant, motif } = req.body;
    const result = await db.addPonction({ ouvrier_id: parseInt(ouvrier_id), date, montant, motif });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Loyers routes
app.get('/api/loyers', async (req, res) => {
  try {
    const loyers = await db.getLoyers();
    res.json(loyers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/loyers/ouvrier/:ouvrierId', async (req, res) => {
  try {
    const loyers = await db.getLoyersByOuvrier(parseInt(req.params.ouvrierId));
    res.json(loyers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loyers', async (req, res) => {
  try {
    const { ouvrier_id, site, qualification, montant_mensuel, mois, annee } = req.body;
    const result = await db.addLoyer({ ouvrier_id: parseInt(ouvrier_id), site, qualification, montant_mensuel, mois, annee: parseInt(annee) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/loyers/:id', async (req, res) => {
  try {
    const { site, qualification, montant_mensuel, mois, annee } = req.body;
    await db.updateLoyer(parseInt(req.params.id), { site, qualification, montant_mensuel, mois, annee: parseInt(annee) });
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/loyers/:id', async (req, res) => {
  try {
    await db.deleteLoyer(parseInt(req.params.id));
    res.json({ message: 'Loyer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paiements loyer routes
app.get('/api/paiements-loyer', async (req, res) => {
  try {
    const paiements = await db.getPaiementsLoyer();
    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/paiements-loyer/ouvrier/:ouvrierId', async (req, res) => {
  try {
    const paiements = await db.getPaiementsLoyerByOuvrier(parseInt(req.params.ouvrierId));
    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paiements-loyer', async (req, res) => {
  try {
    const { ouvrier_id, mois, annee, montant } = req.body;
    const result = await db.addPaiementLoyer({ ouvrier_id: parseInt(ouvrier_id), mois, annee: parseInt(annee), montant });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paies routes
app.get('/api/paies', async (req, res) => {
  try {
    const paies = await db.getPaies();
    res.json(paies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/paies/semaine/:semaine', async (req, res) => {
  try {
    const paies = await db.getPaiesBySemaine(req.params.semaine);
    res.json(paies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paies', async (req, res) => {
  try {
    const result = await db.addPaie({
      ...req.body,
      ouvrier_id: parseInt(req.body.ouvrier_id)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/paies/:id', async (req, res) => {
  try {
    const result = await db.updatePaie(parseInt(req.params.id), req.body);
    res.json(result || { id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/paies/:id', async (req, res) => {
  try {
    await db.deletePaie(parseInt(req.params.id));
    res.json({ message: 'Paie deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/paies/semaine/:semaine', async (req, res) => {
  try {
    await db.deletePaiesBySemaine(req.params.semaine);
    res.json({ message: `Paies for week ${req.params.semaine} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Utilisateurs routes
app.get('/api/utilisateurs', async (req, res) => {
  try {
    const utilisateurs = await db.getUtilisateurs();
    res.json(utilisateurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/utilisateurs/:id', async (req, res) => {
  try {
    const user = await db.getUtilisateur(parseInt(req.params.id));
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utilisateurs', async (req, res) => {
  try {
    const { username, email, password, titre, role, statut } = req.body;
    const result = await db.addUtilisateur({ username, email, password, titre, role, statut });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/utilisateurs/:id', async (req, res) => {
  try {
    // Protection : empêche la désactivation du compte admin
    const existing = await db.getUtilisateur(parseInt(req.params.id));
    if (existing && existing.username === 'admin' && req.body.statut && req.body.statut !== 'actif') {
      return res.status(403).json({ error: 'Le compte administrateur ne peut pas être désactivé.' });
    }
    const result = await db.updateUtilisateur(parseInt(req.params.id), req.body);
    res.json(result || { id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/utilisateurs/:id', async (req, res) => {
  try {
    // Protection : empêche la suppression du compte admin
    const existing = await db.getUtilisateur(parseInt(req.params.id));
    if (existing && existing.username === 'admin') {
      return res.status(403).json({ error: 'Le compte administrateur ne peut pas être supprimé.' });
    }
    await db.deleteUtilisateur(parseInt(req.params.id));
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database reset and reload
app.post('/api/database/reset', async (req, res) => {
  try {
    await db.resetDatabase();
    res.json({ message: 'Base de données réinitialisée avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/database/reload', async (req, res) => {
  try {
    await db.reloadDatabase();
    res.json({ message: 'Base de données rechargée depuis MySQL avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} with MySQL database: gebat_easypaie`);
});
