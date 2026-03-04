"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createPublicClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        router.replace("/");
      }
    }
    void checkSession();
  }, [router, supabase]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      router.replace("/");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "No se pudo iniciar sesion";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      setMessage("Usuario creado. Si tienes confirmacion por correo, validala antes de entrar.");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "No se pudo crear usuario";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <section className="panel w-full p-6">
        <h1 className="text-2xl font-bold">Inventario Cloud TLS - Sede Arequipa</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Inicia sesion para acceder al sistema.</p>

        {message ? <p className="mt-3 rounded-lg bg-emerald-100 p-2 text-sm">{message}</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{error}</p> : null}

        <form className="mt-4 space-y-3" onSubmit={signIn}>
          <label className="block">
            Correo
            <input
              className="field mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block">
            Contrasena
            <input
              className="field mt-1"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Procesando..." : "Entrar"}
            </button>
            <button type="button" className="btn" disabled={loading} onClick={() => void signUp()}>
              Crear usuario
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
