from __future__ import annotations

from typing import Optional

import requests


def send_executive_summary(
    message: str,
    telegram_webhook: Optional[str],
    telegram_chat_id: Optional[str],
    logger,
) -> bool:
    if not telegram_webhook or not telegram_chat_id:
        logger.error("Webhook o Chat ID no configurados")
        return False

    payload = {
        "chat_id": telegram_chat_id,
        "text": message,
        "parse_mode": "HTML",
    }
    resp = requests.post(telegram_webhook, json=payload)
    return resp.status_code == 200
