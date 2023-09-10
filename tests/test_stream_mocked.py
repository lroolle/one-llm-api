import os
import openai
import pytest


"""
NOTE: this tests depends on the service response, it do fails, but we do not need to care about it.
"""

API_KEY = os.environ.get("ONELLM_API_KEY")
API_BASE = os.environ.get("OPENAI_API_BASE", "http://127.0.0.1:8787/v1")

openai.api_key = API_KEY
openai.api_base = API_BASE

MESSAGES = [
    {
        "role": "user",
        "content": "Please repeat:Hello everyone, I am Assistant.",
    },
]


def test_openai_stream_chat_completion():
    chat_completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=MESSAGES,
        temperature=0.0,
        stream=True,
    )
    assert chat_completion is not None

    messages = list(chat_completion)

    content = "".join(
        map(lambda m: m["choices"][0]["delta"].get("content", ""), messages)
    )

    assert content == "Hello ChatGPT.", print(content)
