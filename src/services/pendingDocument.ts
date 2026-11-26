import { DocumentImageInput } from '../types/vozGuia';

let pendingDocument: { id: string; image: DocumentImageInput } | null = null;

export function setPendingDocument(image: DocumentImageInput): string {
  const id = String(Date.now());
  pendingDocument = { id, image };
  return id;
}

export function consumePendingDocument(id: string): DocumentImageInput | null {
  if (!pendingDocument || pendingDocument.id !== id) {
    return null;
  }
  const { image } = pendingDocument;
  pendingDocument = null;
  return image;
}
