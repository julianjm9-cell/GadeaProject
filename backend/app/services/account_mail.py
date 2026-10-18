"""Account messages only. Secrets are never returned over HTTP or written to logs."""
from email.message import EmailMessage
import smtplib
import ssl
from urllib.parse import urlencode
from app.config import get_settings


def mail_enabled():
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from)


def send_account_mail(email, token, purpose):
    settings = get_settings()
    subject = "Verifica tu correo" if purpose == "verify" else "Recupera tu contraseña"
    # Trusted configuration, never the request Host. Fragment avoids access-log leakage.
    link = settings.public_base_url.rstrip("/") + "/cuenta#" + urlencode({"action": purpose, "token": token})
    message = EmailMessage()
    message["Subject"] = subject + " · Profesor Particular"
    message["From"], message["To"] = settings.smtp_from, email
    message.set_content(f"{subject}\n\nAbre este enlace para continuar:\n{link}\n\nCaduca en 30 minutos y solo se puede usar una vez. Si no lo solicitaste, ignora este mensaje. No compartas el enlace.")
    connection = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
    options = {"timeout":15, **({"context":ssl.create_default_context()} if settings.smtp_ssl else {})}
    with connection(settings.smtp_host, settings.smtp_port, **options) as server:
        if settings.smtp_starttls and not settings.smtp_ssl:
            server.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
