
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AuthGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setChecking(false);

        if (!currentUser) {
          router.replace("/login");
        }
      }
    );

    return unsubscribe;
  }, [router]);

  if (checking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Checking your login...
      </main>
    );
  }

  return <>{children}</>;
}
