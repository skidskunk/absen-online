import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Static assets & public routes bypass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/offline" ||
    pathname.startsWith("/workbox-")
  ) {
    return response;
  }

  // Get current user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If accessing /admin or /admin/*
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login-admin", request.url));
    }

    // Check user role from profiles
    let userRole = "user";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role) {
        userRole = profile.role;
      } else {
        // Fallback for default admin emails/metadata
        if (user.email === "superadmin@absen.local") {
          userRole = "super_admin";
        } else if (user.email === "admin@absen.local") {
          userRole = "admin";
        } else if (user.user_metadata?.role) {
          userRole = user.user_metadata.role;
        }
      }
    } catch {
      if (user.email === "superadmin@absen.local") {
        userRole = "super_admin";
      } else if (user.email === "admin@absen.local") {
        userRole = "admin";
      } else if (user.user_metadata?.role) {
        userRole = user.user_metadata.role;
      }
    }

    if (userRole !== "admin" && userRole !== "super_admin") {
      // User is not admin/super_admin -> redirect to user page /
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // If accessing /login-admin when already logged in as admin/super_admin
  if (pathname === "/login-admin" && user) {
    let userRole = "user";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role) {
        userRole = profile.role;
      } else if (user.email === "superadmin@absen.local") {
        userRole = "super_admin";
      } else if (user.email === "admin@absen.local") {
        userRole = "admin";
      }
    } catch {
      if (user.email === "superadmin@absen.local") {
        userRole = "super_admin";
      } else if (user.email === "admin@absen.local") {
        userRole = "admin";
      }
    }

    if (userRole === "admin" || userRole === "super_admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline|icons).*)",
  ],
};
