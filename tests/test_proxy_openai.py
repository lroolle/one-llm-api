import os
import openai
import pytest


"""
NOTE: this tests depends on the service response, it do fails, but we do not need to care about it.
"""

API_KEY = os.environ.get("PROXY_OPENAI_API_KEY")
API_BASE = os.environ.get("PROXY_OPENAI_API_BASE")

openai.api_key = API_KEY
openai.api_base = API_BASE

MESSAGES = [
    {
        "role": "user",
        "content": "Please say `Hello everyone, I am <your name here>.`",
    },
]


def test_proxy_openai_chat_completion():
    chat_completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.0,
        messages=MESSAGES,
    )
    assert chat_completion and len(chat_completion["choices"]) > 0, print(
        chat_completion
    )
    assert chat_completion["choices"][0]["message"]["content"].startswith(
        "Hello everyone, I am"
    ), print(chat_completion)


def test_proxy_openai_stream_chat_completion():
    chat_completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=MESSAGES,
        temperature=0.0,
        stream=True,
    )
    assert chat_completion is not None

    messages = list(chat_completion)

    assert messages[0] and len(messages[0]["choices"]) > 0, print(messages)
    assert messages[0]["model"].startswith("gpt-3.5-turbo"), print(messages[0])
    assert messages[0]["choices"][0]["index"] == 0, print(messages[0])
    assert messages[0]["choices"][0]["delta"]["role"] == "assistant", print(messages[0])
    assert messages[0]["choices"][0]["delta"]["content"] == "", print(messages[0])
    assert messages[-1]["choices"][0]["finish_reason"] == "stop", print(messages[-1])

    content = "".join(
        map(lambda m: m["choices"][0]["delta"].get("content", ""), messages)
    )

    assert content.startswith("Hello everyone, I am"), print(content)


def test_proxy_openai_claude2_chat_completion():
    chat_completion = openai.ChatCompletion.create(
        model="claude-2",
        temperature=0.0,
        messages=MESSAGES,
    )
    assert chat_completion and len(chat_completion["choices"]) > 0, print(
        chat_completion
    )
    assert chat_completion["choices"][0]["message"]["content"], print(chat_completion)
    content = chat_completion["choices"][0]["message"]["content"]
    assert content.strip() == "Hello everyone, I am Claude.", print(content)


def test_proxy_claude2_openai_stream_chat_completion():
    chat_completion = openai.ChatCompletion.create(
        model="claude-2",
        temperature=0.0,
        messages=MESSAGES,
        stream=True,
    )
    assert chat_completion is not None

    messages = list(chat_completion)

    assert messages[0] and len(messages[0]["choices"]) > 0, print(messages)
    assert messages[0]["model"].startswith("claude-2"), print(messages[0])
    assert messages[0]["choices"][0]["index"] == 0, print(messages[0])
    assert messages[0]["choices"][0]["delta"]["role"] == "assistant", print(messages[0])
    # assert messages[0]["choices"][0]["delta"]["content"] == "", print(messages[0])
    # assert messages[-1]["choices"][0]["finish_reason"] == "stop", print(messages])

    content = "".join(
        map(lambda m: m["choices"][0]["delta"].get("content", ""), messages)
    )

    assert content.strip() == "Hello everyone, I am Claude.", print(content)
