"""Preferences ranking agent for ranking patient priority."""

from google.adk import Agent
from google.genai import types
from dotenv import load_dotenv
import os
from . import prompt

load_dotenv()
MODEL = os.environ["MODEL"]


root_agent = Agent(
    model=MODEL,
    name="preferences_ranker",
    description=(
        "Takes 5 highest priority patients for a specific appointment and ranks them based on alignment of patient preferences to hospital facilities. Also considers patient proximity if present."
    ),
    instruction=prompt.PREFERENCES_RANKER_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        temperature=0,
    ),
)