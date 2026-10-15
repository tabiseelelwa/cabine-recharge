// Exécuté une fois au démarrage du serveur Next.js :
// met la base à jour automatiquement après une mise à jour de l'application.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { connexionMultiple } = await import('./lib/db');
      const { migrer } = await import('./lib/migrations.mjs');
      const conn = await connexionMultiple();
      try {
        await migrer(conn, (m) => console.log('[base] ' + m));
      } finally {
        await conn.end();
      }
    } catch (e) {
      console.error('[base] Mise à jour automatique impossible :', (e as Error).message);
      console.error('[base] Vérifiez MySQL puis lancez "npm run db:init".');
    }
  }
}
