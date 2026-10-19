import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Correos de la app por SMTP propio (Gmail con contrasena de aplicacion, Brevo, etc.).
// Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y EMAIL_REMITENTE ("Eat-em <correo@...>").
export const correoConfigurado = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporte: Transporter | null = null;
function smtp() {
  if (!transporte) {
    const puerto = Number(process.env.SMTP_PORT || 465);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: puerto, secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
  }
  return transporte;
}

export async function enviarCorreo(para: string, c: { asunto: string; html: string; texto: string }) {
  await smtp().sendMail({
    from: process.env.EMAIL_REMITENTE || `Eat-em <${process.env.SMTP_USER}>`,
    to: para, subject: c.asunto, html: c.html, text: c.texto,
  });
}

// --- Plantillas (espanol, sin imagenes externas para que se vean en cualquier cliente) ---

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function plantilla(titulo: string, parrafo: string, boton: string, enlace: string, pie: string) {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f3efe6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1913">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fbf9f4;border:1px solid #dcd6c8;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:18px;font-weight:700;color:#1f4a37;padding-bottom:24px">Eat-em</td></tr>
<tr><td style="font-size:26px;font-weight:700;line-height:1.15;letter-spacing:-0.02em;padding-bottom:12px">${esc(titulo)}</td></tr>
<tr><td style="font-size:16px;line-height:1.55;color:#4a473e;padding-bottom:28px">${esc(parrafo)}</td></tr>
<tr><td><a href="${esc(enlace)}" style="display:inline-block;background:#1f4a37;color:#f6f3ea;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">${esc(boton)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6a665a;padding-top:28px">${esc(pie)}<br><br>Si el botón no funciona, copia este enlace en el navegador:<br><span style="word-break:break-all;color:#1f4a37">${esc(enlace)}</span></td></tr>
</table></td></tr></table></body></html>`;
  const texto = `${titulo}\n\n${parrafo}\n\n${boton}: ${enlace}\n\n${pie}\n`;
  return { html, texto };
}

export const correoConfirmar = (enlace: string, nombre?: string) => ({
  asunto: "Confirma tu cuenta de Eat-em",
  ...plantilla(nombre ? `Hola, ${nombre}` : "Confirma tu correo",
    "Para activar tu cuenta de Eat-em pulsa el botón. Ábrelo en el mismo móvil o navegador donde la creaste.",
    "Confirmar mi cuenta", enlace, "Si no has creado ninguna cuenta, ignora este correo. El enlace caduca en 24 horas."),
});

export const correoEnlace = (enlace: string) => ({
  asunto: "Tu enlace para entrar en Eat-em",
  ...plantilla("Entra en Eat-em", "Pulsa el botón para entrar sin contraseña. Ábrelo en el mismo móvil o navegador donde lo pediste.",
    "Entrar", enlace, "Si no lo has pedido tú, ignora este correo. El enlace caduca en 1 hora y solo sirve una vez."),
});

export const correoRecuperar = (enlace: string) => ({
  asunto: "Cambia tu contraseña de Eat-em",
  ...plantilla("¿Olvidaste tu contraseña?", "Pulsa el botón para entrar y poner una contraseña nueva en Ajustes.",
    "Poner contraseña nueva", enlace, "Si no lo has pedido tú, ignora este correo: tu contraseña no cambia. El enlace caduca en 1 hora."),
});
