from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

LOCAL_TIMEZONE = "Europe/London"

def is_evening_hours() -> bool:
    """
    Check if current time is evening hours (between 8 PM and 6 AM UK time).
    
    Returns:
        bool: True if current time is between 20:00 and 06:00 UK time
    """
    current_time = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE))
    return current_time.hour >= 20 or current_time.hour < 6

def datetime_add(hours: int, truncate_to_hour: bool = False) -> str:
    """
    Add hours to current London time and return as ISO string.
    
    Args:
        hours: Number of hours to add
        truncate_to_hour: Whether to truncate to hour before adding (default: False)
    
    Returns:
        str: Datetime as ISO string without timezone info
    """
    current_time = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE))
    if truncate_to_hour:
        current_time = current_time.replace(minute=0, second=0, microsecond=0)
    result_time = current_time + timedelta(hours=hours)
    return result_time.replace(tzinfo=None).isoformat()

def datetime_sub(hours: int, truncate_to_hour: bool = False) -> str:
    """
    Subtract hours from current London time and return as ISO string.
    
    Args:
        hours: Number of hours to subtract
        truncate_to_hour: Whether to truncate to hour before subtracting (default: False)
    
    Returns:
        str: Datetime as ISO string without timezone info
    """
    current_time = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE))
    if truncate_to_hour:
        current_time = current_time.replace(minute=0, second=0, microsecond=0)
    result_time = current_time - timedelta(hours=hours)
    return result_time.replace(tzinfo=None).isoformat()
