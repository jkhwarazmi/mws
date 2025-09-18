"""Clinical grading agent for assessing patient referral urgency."""

from google.adk import Agent
from google.adk.agents import ParallelAgent, LoopAgent
from google.adk.tools import exit_loop
from google.genai import types
from dotenv import load_dotenv
import os

from .sub_agents.urgency_grader import urgency_grader_agent
from .sub_agents.condition_grader import condition_grader_agent
from .sub_agents.comorbidities_grader import comorbidities_grader_agent


load_dotenv()
MODEL = os.environ["MODEL"]

root_agent = ParallelAgent(
    name="clinical_grader",
    description=(
        "Takes patient data as input and evaluates clinical urgency, condition severity, and comorbidities impact in parallel to assess patient referral priority."
    ),
    sub_agents=[urgency_grader_agent, condition_grader_agent, comorbidities_grader_agent],
)
