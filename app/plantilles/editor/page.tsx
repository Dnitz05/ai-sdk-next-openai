import { redirect } from 'next/navigation';

export default function EditorRedirectPage() {
  // Redirigeix a l'editor sense id (creació de nova plantilla)
  redirect('/plantilles/editor/new');
}