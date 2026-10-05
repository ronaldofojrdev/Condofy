export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ResetarSenhaForm from "./resetar-senha-form";

export default function ResetarSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <ResetarSenhaForm />
    </Suspense>
  );
}