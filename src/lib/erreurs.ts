// Erreur HTTP « métier » : son message est affiché tel quel à l'utilisateur
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
