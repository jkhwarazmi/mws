"""Urgency grader agent for assessing clinical urgency."""

from google.adk import Agent
from google.genai import types
from dotenv import load_dotenv
import os

from . import prompt


load_dotenv()
MODEL = os.environ["MODEL"]

urgency_grader_agent = Agent(
    model=MODEL,
    name="urgency_grader",
    instruction=prompt.URGENCY_GRADER_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        temperature=0,
    ),
)
