// app/(auth)/callback/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.origin + '/login#' + url.searchParams.toString();
  return NextResponse.redirect(redirectTo);
}