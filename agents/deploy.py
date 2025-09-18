"""Deployment script for Clinical Grader Agent."""

import os

from absl import app
from absl import flags
from dotenv import load_dotenv

import vertexai
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp

# Dynamic imports will be handled in main() based on agent selection

FLAGS = flags.FLAGS
flags.DEFINE_string("project_id", None, "GCP project ID.")
flags.DEFINE_string("location", None, "GCP location.")
flags.DEFINE_string("bucket", None, "GCP bucket.")
flags.DEFINE_string("resource_id", None, "ReasoningEngine resource ID.")
flags.DEFINE_string("user_id", "test_user", "User ID for session operations.")
flags.DEFINE_string("session_id", None, "Session ID for operations.")
flags.DEFINE_string("message", None, "Message to send to the agent.")
flags.DEFINE_string("agent", "clinical_agent", "Agent type to deploy (default: clinical_agent).")
flags.DEFINE_string("service_account", None, "Service account email with BigQuery permissions.")

flags.DEFINE_bool("list", False, "List all agents.")
flags.DEFINE_bool("create", False, "Creates a new agent.")
flags.DEFINE_bool("delete", False, "Deletes an existing agent.")
flags.DEFINE_bool("create_session", False, "Creates a new session.")
flags.DEFINE_bool("list_sessions", False, "Lists all sessions for a user.")
flags.DEFINE_bool("get_session", False, "Gets a specific session.")
flags.DEFINE_bool("delete_session", False, "Deletes a specific session.")
flags.DEFINE_bool("query", False, "Sends a message to the deployed agent.")
flags.mark_bool_flags_as_mutual_exclusive(["create", "delete", "list", "create_session", "list_sessions", "get_session", "delete_session", "query"])


def create(agent_module) -> None:
    """Creates an agent engine."""
    adk_app = AdkApp(agent=agent_module.root_agent, enable_tracing=True)

    env_vars = {
        "MODEL": os.getenv("MODEL"),
    }
    
    if not env_vars.get("MODEL"):
        print("ERROR: MODEL environment variable is required")
        return

    # Get service account from flag or environment
    service_account = (
        FLAGS.service_account 
        if FLAGS.service_account 
        else os.getenv("SERVICE_ACCOUNT_EMAIL")
    )
    
    # Extract agent package name from module
    agent_package = agent_module.__name__.split('.')[0]
    
    create_kwargs = {
        "agent_engine": adk_app,
        "display_name": agent_module.root_agent.name,
        "requirements": [
            "google-adk==1.4.2",
            "google-cloud-aiplatform==1.95.1",
            "python-dotenv>=1.0.0",
            "pydantic==2.11.7",
            "cloudpickle==3.1.1",
        ],
        "extra_packages": [f"./{agent_package}"],
        "env_vars": env_vars,
    }
    
    # Add service account if provided
    if service_account:
        create_kwargs["service_account"] = service_account
        print(f"Using service account: {service_account}")
    else:
        print("Warning: No service account specified - using default compute service account")
    
    remote_agent = agent_engines.create(**create_kwargs)
    print(f"Created remote agent: {remote_agent.resource_name}")
    print(f"Environment variables passed: {list(env_vars.keys())}")


def delete(resource_id: str) -> None:
    """Deletes a specific agent."""
    remote_agent = agent_engines.get(resource_id)
    remote_agent.delete(force=True)
    print(f"Deleted remote agent: {resource_id}")


def list_agents() -> None:
    """Lists all agents."""
    remote_agents = agent_engines.list()
    if not remote_agents:
        print("No agents found.")
        return
    template = """{agent.name} ("{agent.display_name}")
- Create time: {agent.create_time}
- Update time: {agent.update_time}
- Resource ID: {agent.resource_name}
"""
    remote_agents_string = '\n'.join(template.format(agent=agent) for agent in remote_agents)
    print(f"All remote agents:\n{remote_agents_string}")


def create_session(resource_id: str, user_id: str) -> None:
    """Creates a new session for the specified user."""
    remote_agent = agent_engines.get(resource_id)
    remote_session = remote_agent.create_session(user_id=user_id)
    print("Created session:")
    print(f"  Session ID: {remote_session['id']}")
    print(f"  User ID: {remote_session['userId']}")
    print(f"  App name: {remote_session['appName']}")
    print(f"  Last update time: {remote_session['lastUpdateTime']}")
    print("\nUse this session ID with --session_id when querying the agent.")


def list_sessions(resource_id: str, user_id: str) -> None:
    """Lists all sessions for the specified user."""
    remote_agent = agent_engines.get(resource_id)
    sessions = remote_agent.list_sessions(user_id=user_id)
    print(f"Sessions for user '{user_id}':")
    if not sessions['sessions']:
        print("  No sessions found.")
        return
    for session in sessions['sessions']:
        print(f"  - Session ID: {session['id']}")


def get_session(resource_id: str, user_id: str, session_id: str) -> None:
    """Gets a specific session."""
    remote_agent = agent_engines.get(resource_id)
    session = remote_agent.get_session(user_id=user_id, session_id=session_id)
    print("Session details:")
    print(f"  ID: {session['id']}")
    print(f"  User ID: {session['userId']}")
    print(f"  App name: {session['appName']}")
    print(f"  Last update time: {session['lastUpdateTime']}")


def delete_session(resource_id: str, user_id: str, session_id: str) -> None:
    """Deletes a specific session."""
    remote_agent = agent_engines.get(resource_id)
    remote_agent.delete_session(user_id=user_id, session_id=session_id)
    print(f"Deleted session: {session_id} for user: {user_id}")


def query_agent(resource_id: str, user_id: str, session_id: str, message: str) -> None:
    """Sends a message to the deployed agent."""
    remote_agent = agent_engines.get(resource_id)
    
    print(f"Querying agent with message")
    print(f"Session: {session_id}")
    print(f"User: {user_id}")
    print("\nResponse:")
    print("-" * 50)
    
    for event in remote_agent.stream_query(
        user_id=user_id,
        session_id=session_id,
        message=message,
    ):
        print(event)

def main(argv: list[str]) -> None:
    del argv
    load_dotenv()

    # Determine which agent to use
    agent_type = FLAGS.agent
    agent_module = None
    
    # Future agents can be added here with elif statements
    if agent_type == "clinical_agent":
        from clinical_agent.agent import root_agent
        import clinical_agent.agent as agent_module_import
        agent_module = agent_module_import
        print(f"Using {agent_type}")
    elif agent_type == "preferences_agent":
        import preferences_agent.agent as agent_module
        print(f"Using {agent_type}")
    else:
        print(f"Unknown agent type: {agent_type}. Available agents: clinical_agent")
        return

    project_id = (
        FLAGS.project_id
        if FLAGS.project_id
        else os.getenv("GOOGLE_CLOUD_PROJECT")
    )
    location = (
        FLAGS.location if FLAGS.location else os.getenv("GOOGLE_CLOUD_LOCATION")
    )
    bucket = (
        FLAGS.bucket if FLAGS.bucket
        else os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET")
    )

    print(f"PROJECT: {project_id}")
    print(f"LOCATION: {location}")
    print(f"BUCKET: {bucket}")

    if not project_id:
        print("Missing required environment variable: GOOGLE_CLOUD_PROJECT")
        return
    elif not location:
        print("Missing required environment variable: GOOGLE_CLOUD_LOCATION")
        return
    elif not bucket:
        print(
            "Missing required environment variable: GOOGLE_CLOUD_STORAGE_BUCKET"
        )
        return

    vertexai.init(
        project=project_id,
        location=location,
        staging_bucket=f"gs://{bucket}",
    )

    if FLAGS.list:
        list_agents()
    elif FLAGS.create:
        create(agent_module)
    elif FLAGS.delete:
        if not FLAGS.resource_id:
            print("resource_id is required for delete")
            return
        delete(FLAGS.resource_id)
    elif FLAGS.create_session:
        if not FLAGS.resource_id:
            print("resource_id is required for create_session")
            return
        create_session(FLAGS.resource_id, FLAGS.user_id)
    elif FLAGS.list_sessions:
        if not FLAGS.resource_id:
            print("resource_id is required for list_sessions")
            return
        list_sessions(FLAGS.resource_id, FLAGS.user_id)
    elif FLAGS.get_session:
        if not FLAGS.resource_id:
            print("resource_id is required for get_session")
            return
        if not FLAGS.session_id:
            print("session_id is required for get_session")
            return
        get_session(FLAGS.resource_id, FLAGS.user_id, FLAGS.session_id)
    elif FLAGS.delete_session:
        if not FLAGS.resource_id:
            print("resource_id is required for delete_session")
            return
        if not FLAGS.session_id:
            print("session_id is required for delete_session")
            return
        delete_session(FLAGS.resource_id, FLAGS.user_id, FLAGS.session_id)
    elif FLAGS.query:
        if not FLAGS.resource_id:
            print("resource_id is required for query")
            return
        if not FLAGS.session_id:
            print("session_id is required for query")
            return
        if not FLAGS.message:
            print("message is required for query")
            return
        query_agent(FLAGS.resource_id, FLAGS.user_id, FLAGS.session_id, FLAGS.message)
    else:
        print("Please specify one of: --create, --delete, --list, --create_session, --list_sessions, --get_session, --delete_session, or --query")


if __name__ == "__main__":
    app.run(main)