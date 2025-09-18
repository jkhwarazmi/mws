"""Condition grader agent for assessing clinical conditions."""

from google.adk import Agent
from google.genai import types
from dotenv import load_dotenv
import os

from . import prompt


load_dotenv()
MODEL = os.environ["MODEL"]

condition_grader_agent = Agent(
    model=MODEL,
    name="condition_grader",
    instruction=prompt.CONDITION_GRADER_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        temperature=0,
    ),
)
