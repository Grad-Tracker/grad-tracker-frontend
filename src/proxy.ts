import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAdvisorSignupGateCookieName,
  verifyAdvisorSignupGateToken,
} from "@/lib/advisor-signup-gate";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session to keep it alive.
  // IMPORTANT: Use getUser() not getSession() — getUser() validates with
  // the Supabase Auth server, while getSession() only reads the local JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminSignin = pathname === "/admin/signin";
  const isAdminSignup = pathname === "/admin/signup";
  const isAdminPublicAuth = isAdminSignin || isAdminSignup;
  const hasAdvisorSignupCookie = verifyAdvisorSignupGateToken(
    request.cookies.get(getAdvisorSignupGateCookieName())?.value
  );

  const isAdvisor = user?.user_metadata?.role === "advisor";

  if (!user && isAdminSignup && !hasAdvisorSignupCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("advisor", "1");
    return NextResponse.redirect(url);
  }

  // Unauthenticated users trying to access protected routes → redirect to signin
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      (pathname.startsWith("/admin") && !isAdminPublicAuth))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // Authenticated non-advisors trying to access /admin → redirect to dashboard
  if (user && !isAdvisor && pathname.startsWith("/admin") && !isAdminPublicAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Authenticated users visiting auth pages → redirect to their home area
  // (but allow /reset-password so users can finish changing their password)
  if (
    user &&
    (pathname === "/signin" ||
      isAdminSignin ||
      isAdminSignup ||
      pathname === "/signup" ||
      pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = isAdvisor ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Unauthenticated users on /reset-password have no session to update with
  if (!user && pathname === "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
