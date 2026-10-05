"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { Building2, Eye, EyeOff, Loader2, Mail, Lock, UserPlus, ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { useRBAC } from "@/components/auth/rbac-provider";

type Mode = "login" | "register" | "reset";

const firebaseMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) return "Ocurrió un error. Intenta nuevamente.";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con este correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "Ingresa un correo válido.",
    "auth/popup-closed-by-user": "El acceso con Google fue cancelado.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  };
  return messages[error.code] ?? "No se pudo completar la operación. Intenta nuevamente.";
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, loading: authLoading } = useRBAC();

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, router, user]);

  async function persistSession() {
    if (!auth) throw new Error("Firebase no está configurado.");
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!auth) {
      setError("Firebase no está configurado. Completa las variables de entorno.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage("Te enviamos un enlace para restablecer tu contraseña.");
      } else {
        await persistSession();
        if (mode === "register") {
          await createUserWithEmailAndPassword(auth, email, password);
          setMessage(`Cuenta creada${name.trim() ? ` para ${name.trim()}` : ""}. Redirigiendo...`);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      }
    } catch (submitError) {
      setError(firebaseMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function signInGoogle() {
    setError("");
    if (!auth) {
      setError("Firebase no está configurado. Completa las variables de entorno.");
      return;
    }
    setBusy(true);
    try {
      await persistSession();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (googleError) {
      setError(firebaseMessage(googleError));
    } finally {
      setBusy(false);
    }
  }

  const isReset = mode === "reset";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex items-center gap-2 text-lg font-semibold"><span className="rounded-lg bg-primary p-2 text-primary-foreground"><Building2 size={20} /></span>InmoLab <span className="text-primary">Kölbi</span></div>
          <div><CardTitle>{isReset ? "Recuperar contraseña" : mode === "register" ? "Crear cuenta" : "Bienvenido de nuevo"}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{isReset ? "Te enviaremos un enlace a tu correo." : mode === "register" ? "Regístrate para entrar a la plataforma." : "Ingresa a tu espacio de trabajo."}</p></div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && <label className="block text-sm font-medium">Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>}
            <label className="block text-sm font-medium"><span className="flex items-center gap-2"><Mail size={15} /> Correo electrónico</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-10 w-full rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
            {!isReset && <label className="block text-sm font-medium"><span className="flex items-center gap-2"><Lock size={15} /> Contraseña</span><span className="relative mt-2 block"><input required minLength={6} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-md border px-3 pr-10 font-normal outline-none focus:ring-2 focus:ring-primary" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground" aria-label="Mostrar contraseña">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
            {mode === "login" && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Recordarme</label>}
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 size={17} className="mr-2 animate-spin" /> : null}{busy ? "Procesando..." : isReset ? "Enviar enlace" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</Button>
          </form>
          {!isReset && <><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" /></div><Button type="button" variant="outline" className="w-full" onClick={() => void signInGoogle()} disabled={busy}><span className="mr-2 font-bold">G</span> Continuar con Google</Button></>}
          <div className="mt-6 space-y-3 text-center text-sm">{mode === "login" && <button type="button" className="text-primary hover:underline" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>¿Olvidaste tu contraseña?</button>}{mode !== "reset" ? <p className="text-muted-foreground">{mode === "login" ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}<button type="button" className="font-medium text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Regístrate" : "Inicia sesión"}</button></p> : <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setMode("login")}><ArrowLeft size={15} /> Volver al inicio de sesión</button>}</div>
          {mode === "register" && <p className="mt-4 flex justify-center gap-1 text-xs text-muted-foreground"><UserPlus size={14} /> Tu rol se asigna únicamente mediante Custom Claims.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
