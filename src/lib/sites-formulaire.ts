import { nombre, texte } from './api';

/** Champs d'un site envoyés par le formulaire (communs à la création et à la modification) */
export function lireSite(b: Record<string, any>) {
  const seuil = nombre(b.seuil_batterie, 'Seuil batterie', { min: 0, max: 100, entier: true });
  return {
    nom: texte(b.nom, 'Nom du site', { requis: true, max: 100 })!,
    adresse: texte(b.adresse, 'Adresse', { max: 255 }) ?? '',
    telephone: texte(b.telephone, 'Téléphone', { max: 30 }) ?? '',
    seuil_batterie: seuil ?? 25,
    message_ticket: texte(b.message_ticket, 'Message du ticket', { max: 500 }) ?? '',
  };
}
