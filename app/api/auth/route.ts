import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    const validPin = process.env.ACCESS_PIN;

    if (!validPin) {
      return NextResponse.json({ error: "PIN no configurado en el servidor." }, { status: 500 });
    }

    if (pin !== validPin) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("access_pin", pin, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Request inválido" }, { status: 400 });
  }
}
