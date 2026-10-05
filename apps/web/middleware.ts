import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value });
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "" });
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { session }
  } = await supabase.auth.getSession();

  // Unauthenticated users can't access protected routes
  if (!session && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session) {
    const { data: profile } = await supabase
      .from("perfis_usuario")
      .select("id, condominio_id")
      .eq("usuario_id", session.user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (pathname.startsWith("/onboarding")) {
      if (profile?.id) {
        // Has a profile — only redirect to dashboard if onboarding is complete
        const { data: condo } = await supabase
          .from("condominios")
          .select("onboarding_completo")
          .eq("id", profile.condominio_id)
          .maybeSingle();

        if (condo?.onboarding_completo !== false) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        // onboarding_completo = false → stay on /onboarding to finish the wizard
      }
      // No profile yet → stay on /onboarding (step 1)
    }

    if (pathname.startsWith("/dashboard")) {
      if (!profile?.id) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }

      // Redirect to wizard if onboarding was never completed
      const { data: condo } = await supabase
        .from("condominios")
        .select("onboarding_completo")
        .eq("id", profile.condominio_id)
        .maybeSingle();

      if (condo?.onboarding_completo === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"]
};
