"""Comorbidities grader agent for assessing impact of comorbidities on urgency."""

from google.adk import Agent
from google.genai import types
from dotenv import load_dotenv
import os

from . import prompt


load_dotenv()
MODEL = os.environ["MODEL"]

comorbidities_grader_agent = Agent(
    model=MODEL,
    name="comorbidities_grader",
    instruction=prompt.COMORBIDITIES_GRADER_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        temperature=0,
    ),
)
