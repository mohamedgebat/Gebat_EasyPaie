const mysql = require('mysql2/promise');

(async () => {
    const responseOuvriers = await fetch('http://localhost:3000/api/ouvriers');
    const dbWorkers = await responseOuvriers.json();

    const responsePonctions = await fetch('http://localhost:3000/api/ponctions');
    const ponctions = await responsePonctions.json();

    const responsePaies = await fetch('http://localhost:3000/api/paies');
    const paies = await responsePaies.json();

    for (const worker of dbWorkers) {
        const workerPonctions = ponctions.filter(p => Number(p.ouvrier_id) === Number(worker.id) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
        const totalPaid = workerPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
        
        // Find if they have a paie in the most recent week with ponction > 0
        // We will just check if any recent paies have ponction > 0 despite totalPaid >= 9000
        if (totalPaid >= 9000) {
            const workerPaies = paies.filter(p => Number(p.ouvrier_id) === Number(worker.id) && Number(p.ponction) > 0);
            if (workerPaies.length > 0) {
                // Check if any of these paies are AFTER they reached 9000
                console.log(`Worker ${worker.nom} ${worker.prenom} has totalPaid = ${totalPaid}. They have ${workerPaies.length} paies with ponction > 0.`);
                // Sort worker ponctions by date to see when they reached 9000
                workerPonctions.sort((a,b) => new Date(a.date) - new Date(b.date));
                let runningTotal = 0;
                let dateReached = null;
                for (const p of workerPonctions) {
                    runningTotal += Number(p.montant);
                    if (runningTotal >= 9000 && !dateReached) {
                        dateReached = new Date(p.date);
                    }
                }
                
                const paiesAfter = workerPaies.filter(p => new Date(p.date) > dateReached);
                if (paiesAfter.length > 0) {
                    console.log(`  -> And ${paiesAfter.length} paies were created AFTER they reached 9000!`);
                    paiesAfter.forEach(p => console.log(`      Paie on ${p.date} for ${p.ponction} F`));
                }
            }
        }
    }
})().catch(console.error);
