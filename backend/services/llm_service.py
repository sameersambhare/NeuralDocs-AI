from anthropic import Anthropic, NotFoundError

from core.config import get_settings
from core.prompts import SYSTEM_PROMPT, build_user_prompt


def generate_answer(question: str, context: str) -> str:
    settings = get_settings()
    client = Anthropic(api_key=settings.anthropic_api_key)
    fallback_model = "claude-haiku-4-5-20251001"
    models = [settings.anthropic_model]

    if fallback_model not in models:
        models.append(fallback_model)

    for model in models:
        try:
            response = client.messages.create(
                model=model,
                max_tokens=700,
                temperature=0,
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": build_user_prompt(question, context),
                    }
                ],
            )
            return response.content[0].text
        except NotFoundError:
            if model == models[-1]:
                raise

    raise RuntimeError("No available Anthropic model could generate an answer")
