from __future__ import annotations

from typing import Optional


async def send_email_notification(
    to_email: str,
    subject: str,
    html_content: str,
    logger,
    attachment_data: Optional[bytes] = None,
    attachment_name: Optional[str] = None,
) -> bool:
    sendgrid_key = __import__("os").environ.get("SENDGRID_API_KEY")
    sender_email = __import__("os").environ.get("SENDER_EMAIL", "noreply@mundodeaccesorios.com")

    if sendgrid_key and sendgrid_key != "your_sendgrid_api_key":
        try:
            import base64

            import sendgrid  # type: ignore[import]
            from sendgrid.helpers.mail import (  # type: ignore[import]
                Attachment,
                Disposition,
                FileContent,
                FileName,
                FileType,
                Mail,
            )

            message = Mail(
                from_email=sender_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content,
            )

            if attachment_data and attachment_name:
                encoded = base64.b64encode(attachment_data).decode()
                attachment = Attachment()
                attachment.file_content = FileContent(encoded)
                attachment.file_name = FileName(attachment_name)
                attachment.file_type = FileType("application/pdf")
                attachment.disposition = Disposition("attachment")
                message.attachment = attachment

            sg = sendgrid.SendGridAPIClient(api_key=sendgrid_key)
            response = sg.send(message)
            return response.status_code == 202
        except Exception as exc:
            logger.error(f"SendGrid error: {exc}")
            return False

    logger.info(f"Email would be sent to {to_email}: {subject}")
    return True
