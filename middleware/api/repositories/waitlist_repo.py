from api.utils import BigQueryClient
import os
import requests
import uuid
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
import vertexai
from vertexai import agent_engines
from api.models import WaitlistFilterParams, Patient, GradeOverride, GradingResult
from datetime import datetime
import api.config.project
from datetime import datetime
from zoneinfo import ZoneInfo
from api.utils.time_utils import LOCAL_TIMEZONE, datetime_sub


class WaitlistRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def query_patients(self, params: WaitlistFilterParams):
        filters = []
        parameters = {}
        if params.waitlist_id:
            filters.append(f"waitlist_id = @waitlist_id")
            parameters["waitlist_id"] = ("STRING", params.waitlist_id)
        if params.medical_number:
            filters.append(f"medical_number LIKE @medical_number")
            parameters["medical_number"] = ("STRING", f"%{params.medical_number}%")
        if params.min_referral_date:
            filters.append(f"referral_date >= @min_referral_date")
            parameters["min_referral_date"] = ("DATETIME", params.min_referral_date.isoformat())
        if params.max_referral_date:
            filters.append(f"referral_date <= @max_referral_date")
            parameters["max_referral_date"] = ("DATETIME", params.max_referral_date.isoformat())
        if params.postcode:
            filters.append(f"postcode LIKE @postcode") #? Wildcard makes more sense here but is it needed
            parameters["postcode"] = ("STRING", f"{params.postcode.upper()}%")
        if params.min_clinical_urgency:
            filters.append(f"clinical_urgency >= @min_clinical_urgency")
            parameters["min_clinical_urgency"] = ("INTEGER", params.min_clinical_urgency)
        if params.max_clinical_urgency:
            filters.append(f"clinical_urgency <= @max_clinical_urgency")
            parameters["max_clinical_urgency"] = ("INTEGER", params.max_clinical_urgency)
        if params.min_condition_severity:
            filters.append(f"condition_severity >= @min_condition_severity")
            parameters["min_condition_severity"] = ("INTEGER", params.min_condition_severity)
        if params.max_condition_severity:
            filters.append(f"condition_severity <= @max_condition_severity")
            parameters["max_condition_severity"] = ("INTEGER", params.max_condition_severity)
        if params.min_comorbidities:
            filters.append(f"comorbidities >= @min_comorbidities")
            parameters["min_comorbidities"] = ("FLOAT", params.min_comorbidities)
        if params.max_comorbidities:
            filters.append(f"comorbidities <= @max_comorbidities")
            parameters["max_comorbidities"] = ("FLOAT", params.max_comorbidities)
        if params.department_id:
            filters.append(f"department_id = @department_id")
            parameters["department_id"] = ("STRING", params.department_id)
        if params.grading_status is not None:
            if params.grading_status == 0:
                filters.append(f"grading_status = 'COMPLETED'")
            elif params.grading_status == 1:
                filters.append(f"grading_status IS NULL OR grading_status != 'COMPLETED'")
        if params.assignment_status is not None:
            if params.assignment_status == 0:
                filters.append(f"is_assigned IS FALSE")
            elif params.assignment_status == 1:
                filters.append(f"is_assigned IS TRUE")

        where_clause = " AND ".join(filters)
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM {api.config.project.WAITLIST_FQTN}"
        if where_clause:
            count_query += f" WHERE {where_clause} AND NOT is_seen AND deleted_at IS NULL"
        else:
            count_query += f"WHERE NOT is_seen AND deleted_at IS NULL"
        
        total_result = await self.bq_client.run_query(query=count_query, named_params=parameters)
        total_count = total_result[0]['total'] if total_result else 0
        
        # Get paginated results
        query = f"SELECT * FROM {api.config.project.WAITLIST_FQTN}"

        if where_clause:
            query += f" WHERE {where_clause}"


        if params.order_by:
            query += f" ORDER BY {params.order_by}" #BUG SQL injection possible if validation for this fails, need to parametise
            if params.order_dir and params.order_dir == "desc":
                query += " DESC"
            else:
                query += " ASC"
        else:
            query += " ORDER BY clinical_urgency DESC, condition_severity DESC, comorbidities DESC, referral_date ASC, date_of_birth ASC, waitlist_id ASC"
        
        # Default pagination: page 1, 20 results per page
        page = getattr(params, 'page', 1) or 1
        limit = params.limit or 20
        offset = (page - 1) * limit
        
        query += f" LIMIT {limit} OFFSET {offset}"

        result = await self.bq_client.run_query(query=query, named_params=parameters)

        return {
            'results': result or [],
            'total': total_count,
            'page': page,
            'total_pages': (total_count + limit - 1) // limit,
            'has_next': page * limit < total_count,
            'has_prev': page > 1
        }

    #REFACTOR add to service not repo
    async def grade_patient(self, waitlist_id: str):
        patient_data = await self._get_patient_data(waitlist_id)
        if not patient_data:
            return #? Do we want to handle this case
        
        await self._update_grading_status(waitlist_id, 'GRADING')
        
        try:
            grading_result = await self._process_agent_grading(waitlist_id, patient_data)
            await self._save_grading_results(waitlist_id, grading_result)
        except Exception as e:
            print(f"Unexpected error during clinical grading workflow: {str(e)}")
            await self._update_grading_status(waitlist_id, 'FAILED')


    async def mark_seen(self):
        parameters = {}

        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        parameters["current_time"] = ("DATETIME", current_datetime)

        try:
            query = f"""
            MERGE {api.config.project.WAITLIST_FQTN} w
            USING (
                SELECT DISTINCT waitlist_id
                FROM {api.config.project.APPOINTMENTS_FQTN}
                WHERE appointment_time < @current_time
            ) AS a
            ON w.waitlist_id = a.waitlist_id
            WHEN MATCHED AND w.is_seen IS FALSE THEN
                UPDATE SET is_seen = TRUE
            """
            result = await self.bq_client.run_query(query=query, named_params=parameters)
            return {
                "success": True,
                "message": "Successfully marked patients as seen based on past appointments"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to mark patients as seen: {str(e)}"
            }
    
    async def _get_patient_data(self, waitlist_id: str):
        query = f"""
        SELECT 
            date_of_birth, 
            department_id, 
            referral_notes, 
            referral_date, 
            medical_history
        FROM 
            {api.config.project.WAITLIST_FQTN}
        WHERE 
            waitlist_id = @waitlist_id AND NOT is_seen AND deleted_at IS NULL
        """
        result = await self.bq_client.run_query(query=query, named_params={"waitlist_id": ("STRING", waitlist_id)})
        return result[0] if result else None
    

    async def _update_grading_status(self, waitlist_id: str, status: str):
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)

        query = f"""
        UPDATE 
            {api.config.project.WAITLIST_FQTN}
        SET 
            grading_status = @status, 
            graded_at = @current_time
        WHERE 
            waitlist_id = @waitlist_id
        """
        await self.bq_client.run_query(query=query, named_params={
            "waitlist_id": ("STRING", waitlist_id),
            "status": ("STRING", status),
            "current_time": ("DATETIME", current_datetime)
        })
    
    #REFACTOR add to service layer or new external service file
    async def _process_agent_grading(self, waitlist_id: str, patient_data: dict) -> GradingResult:
        vertexai.init(
            project=os.environ.get('BQ_PROJECT_ID'),
            location=os.environ.get('AGENT_LOCATION'),
            staging_bucket=os.environ.get('AGENT_STAGING_BUCKET')
        )

        username = f"u_{uuid.uuid4().hex[:8]}"
        resource_id = os.environ.get('AGENT_RESOURCE_ID')
        
        remote_agent = agent_engines.get(resource_id)
        session = remote_agent.create_session(user_id=username)
        
        print(f"Started grading session for user {username} with session {session['id']} for waitlist ID {waitlist_id}")

        grading_scores = {
            "urgency_grader": None,
            "condition_grader": None,
            "comorbidities_grader": None
        }

        try:
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                def process_stream():
                    for event in remote_agent.stream_query(
                        user_id=username,
                        session_id=session["id"],
                        message=json.dumps(patient_data, default=str),
                    ):
                        if "content" in event and "parts" in event["content"]:
                            author = event.get("author", "unknown")
                            text = event["content"]["parts"][0].get("text", "")

                            if "SCORE:" in text and "JUSTIFICATION:" in text:
                                if author == "urgency_grader":
                                    grading_scores[author] = GradingResult.extract_score_from_text(text, "clinical_urgency")
                                elif author == "condition_grader":
                                    grading_scores[author] = GradingResult.extract_score_from_text(text, "condition_severity")
                                elif author == "comorbidities_grader":
                                    grading_scores[author] = GradingResult.extract_score_from_text(text, "comorbidities")
                    return grading_scores
                
                grading_scores = await loop.run_in_executor(executor, process_stream)

            justifications = []
            for grader, score_obj in grading_scores.items():
                if score_obj and score_obj.justification:
                    justifications.append(score_obj.justification)
            
            result = GradingResult(
                clinical_urgency=grading_scores["urgency_grader"].score if grading_scores["urgency_grader"] else None,
                condition_severity=grading_scores["condition_grader"].score if grading_scores["condition_grader"] else None,
                comorbidities=grading_scores["comorbidities_grader"].score if grading_scores["comorbidities_grader"] else None,
                agent_justification=" ".join(justifications) if justifications else None
            )
            
            return result
            
        finally:
            remote_agent.delete_session(user_id=username, session_id=session["id"])
            print(f"Ended grading session for user {username} with session {session['id']} for waitlist ID {waitlist_id}")
    


    async def _save_grading_results(self, waitlist_id: str, grading_result: GradingResult):
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        
        update_query = f"""
        UPDATE 
            {api.config.project.WAITLIST_FQTN}
        SET 
            clinical_urgency = @clinical_urgency,
            condition_severity = @condition_severity,
            comorbidities = @comorbidities,
            agent_justification = @agent_justification,
            grading_status = 'COMPLETED',
            graded_at = @current_time,
            edited_at = NULL
        WHERE 
            waitlist_id = @waitlist_id
        """
        parameters = {
            "waitlist_id": ("STRING", waitlist_id),
            "clinical_urgency": ("INTEGER", grading_result.clinical_urgency),
            "condition_severity": ("INTEGER", grading_result.condition_severity),
            "comorbidities": ("FLOAT", grading_result.comorbidities),
            "agent_justification": ("STRING", grading_result.agent_justification),
            "current_time": ("DATETIME", current_datetime)
        }
        await self.bq_client.run_query(query=update_query, named_params=parameters)

    #REFACTOR add to service layer or new external service file
    async def analyse_preferences(self, appointment_id: str, appointment_time: datetime, properties: str,
                                  candidates: list[dict]):
        vertexai.init(
            project=os.environ.get('BQ_PROJECT_ID'),
            location=os.environ.get('AGENT_LOCATION'),
            staging_bucket=os.environ.get('AGENT_STAGING_BUCKET')
        )

        username = f"u_{uuid.uuid4().hex[:8]}"
        resource_id = os.environ.get('PREF_RANKING_AGENT_RESOURCE_ID')

        remote_agent = agent_engines.get(resource_id)
        session = remote_agent.create_session(user_id=username)

        print(
            f"Started session to analyse patient preferences for user {username} with session {session['id']} for appointment ID {appointment_id}")

        filtered_candidates = [
            {
                "waitlist_id": candidate["waitlist_id"],
                "preferences": candidate["preferences"],
                "proximity": candidate["proximity"] if "proximity" in candidate else None
            } for candidate in candidates
        ]

        data = {
            "appointment": {
                "datetime": appointment_time,
                "properties": properties
            },
            "candidates": filtered_candidates
        }

        try:
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                def process_stream():
                    rankings = []

                    for event in remote_agent.stream_query(
                            user_id=username,
                            session_id=session["id"],
                            message=json.dumps(data, default=str),
                    ):
                        if "content" in event and "parts" in event["content"]:
                            text = event["content"]["parts"][0].get("text", "")

                            # strips json markers at start and end of response
                            if text.startswith("```json") and text.endswith("```"):
                                text = text[len("```json"): -len("```")].strip()

                            try:
                                result = json.loads(text)
                                if result["status"] == "success":
                                    for ranking in result["rankings"]:
                                        rankings.append({
                                            "waitlist_id": ranking["waitlist_id"],
                                            "rank": ranking["rank"],
                                            "reasoning": ranking["reasoning"]
                                        })
                            except json.JSONDecodeError as e:
                                print(f"JSON decoding error: {e}")

                    return rankings

                rankings = await loop.run_in_executor(executor, process_stream)

                candidates_with_ranking = []
                for ranking in rankings:
                    candidate_info = next((c for c in candidates if c["waitlist_id"] == ranking["waitlist_id"]), None)
                    if candidate_info:
                        candidate_info["rank"] = ranking["rank"]
                        candidate_info["reasoning"] = ranking["reasoning"]
                        candidates_with_ranking.append(candidate_info)

                # sorts according to ranking
                candidates_with_ranking.sort(key=lambda c: c["rank"])

                return candidates_with_ranking

        finally:
            remote_agent.delete_session(user_id=username, session_id=session["id"])
            print(
                f"Ended ranking session for user {username} with session {session['id']} for appointment ID {appointment_id}")

    async def get_ungraded_waitlist_ids(self):
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)

        query = f"""
        SELECT waitlist_id 
        FROM {api.config.project.WAITLIST_FQTN}
        WHERE grading_status IS NULL
        OR grading_status = "FAILED"
        OR (grading_status = "GRADING" AND graded_at <= @past_hour)
        AND NOT is_seen AND deleted_at IS NULL
        """

        result = await self.bq_client.run_query(query=query, named_params={"past_hour": ("DATETIME", datetime_sub(hours=1, truncate_to_hour=True))})
        
        return [row['waitlist_id'] for row in result] if result else []

    async def add_patient(self, patient: Patient):
        
        # Check for existing Medical number
        query_medical = f"""
        SELECT *
        FROM {api.config.project.WAITLIST_FQTN}
        WHERE medical_number = @medical_number
        ORDER BY referral_date DESC
        LIMIT 1
        """
        
        existing_result = await self.bq_client.run_query(query=query_medical, named_params={"medical_number": ("STRING", patient.medical_number)})
        new_waitlist_id = str(uuid.uuid4())
        
        #REFACTOR add to service, this function should just add, no check in this class, that is service's job
        if existing_result:
            # Patient exists - get the last entry
            last_entry = existing_result[0]
            
            # Start with existing medical history
            new_medical_history = last_entry.get('medical_history', [])
            
            # Add the previous referral to the top
            if last_entry.get('referral_notes') and last_entry.get('referral_date'):
                referral_date = last_entry['referral_date']
                if hasattr(referral_date, 'strftime'):
                    date_str = referral_date.strftime('%Y-%m-%d')
                else:
                    date_str = str(referral_date)
                
                previous_entry = {
                    "date": date_str,
                    "notes": last_entry['referral_notes']
                }
                
                # Insert at the beginning
                if isinstance(new_medical_history, list):
                    new_medical_history.insert(0, previous_entry)
                else:
                    new_medical_history = [previous_entry]
            
            # Create new record with updated medical history and patient data
            date_of_birth = patient.date_of_birth or last_entry.get('date_of_birth')
            if hasattr(date_of_birth, 'isoformat'):
                date_of_birth = date_of_birth.isoformat()
            elif hasattr(date_of_birth, 'strftime'):
                date_of_birth = date_of_birth.strftime('%Y-%m-%d')
            
            insert_data = {
                "waitlist_id": new_waitlist_id,
                "medical_number": patient.medical_number,
                "referral_date": patient.referral_date.isoformat(),
                "date_of_birth": date_of_birth,
                "postcode": patient.postcode or last_entry.get('postcode'),
                "department_id": patient.referral_department,
                "referral_notes": patient.referral_notes,
                "medical_history": new_medical_history if new_medical_history else None,
                "clinical_urgency": None,
                "condition_severity": None,
                "comorbidities": None,
                "agent_justification": None,
                "edited_at": None,
                "is_seen": False,
                "grading_status": None,
                "graded_at": None,
                "is_assigned": False,
                "preferences": patient.preferences if patient.preferences else None,
                "prefers_evening": patient.prefers_evening if patient.prefers_evening else False
            }
        else:
            #  Insert new patient with provided data only
            medical_history_dicts = []
            if patient.medical_history:
                for entry in patient.medical_history:
                    if hasattr(entry, 'date') and hasattr(entry, 'notes'):
                        medical_history_dicts.append({
                            "date": entry.date,
                            "notes": entry.notes
                        })
                    elif isinstance(entry, dict):
                        medical_history_dicts.append(entry)
            
            insert_data = {
                "waitlist_id": new_waitlist_id,
                "medical_number": patient.medical_number,
                "referral_date": patient.referral_date.isoformat(),
                "date_of_birth": patient.date_of_birth,
                "postcode": patient.postcode,
                "department_id": patient.referral_department,
                "referral_notes": patient.referral_notes,
                "medical_history": medical_history_dicts if medical_history_dicts else None,
                "clinical_urgency": None,
                "condition_severity": None,
                "comorbidities": None,
                "agent_justification": None,
                "edited_at": None,
                "is_seen": False,
                "grading_status": None,
                "graded_at": None,
                "is_assigned": False,
                "preferences": patient.preferences if patient.preferences else None,
                "prefers_evening": patient.prefers_evening if patient.prefers_evening else False
            }
        
        # Insert the new record
        insert_query = f"""
        INSERT INTO {api.config.project.WAITLIST_FQTN} (
            waitlist_id, medical_number, referral_date, date_of_birth, postcode,
            department_id, referral_notes, medical_history, clinical_urgency,
            condition_severity, comorbidities, agent_justification, edited_at,
            is_seen, grading_status, graded_at, is_assigned, preferences, prefers_evening
        ) VALUES (
            @waitlist_id, @medical_number, @referral_date, @date_of_birth, @postcode,
            @department_id, @referral_notes, @medical_history, @clinical_urgency,
            @condition_severity, @comorbidities, @agent_justification, @edited_at,
            @is_seen, @grading_status, @graded_at, @is_assigned, @preferences, @prefers_evening
        )
        """
        
        insert_params = {
            "waitlist_id": ("STRING", insert_data["waitlist_id"]),
            "medical_number": ("STRING", insert_data["medical_number"]),
            "referral_date": ("DATETIME", insert_data["referral_date"]),
            "date_of_birth": ("STRING", insert_data["date_of_birth"]),
            "postcode": ("STRING", insert_data["postcode"]),
            "department_id": ("STRING", insert_data["department_id"]),
            "referral_notes": ("STRING", insert_data["referral_notes"]),
            "medical_history": ("JSON", insert_data["medical_history"]),
            "clinical_urgency": ("INTEGER", insert_data["clinical_urgency"]),
            "condition_severity": ("INTEGER", insert_data["condition_severity"]),
            "comorbidities": ("FLOAT", insert_data["comorbidities"]),
            "agent_justification": ("STRING", insert_data["agent_justification"]),
            "edited_at": ("DATETIME", insert_data["edited_at"]),
            "is_seen": ("BOOL", insert_data["is_seen"]),
            "grading_status": ("STRING", insert_data["grading_status"]),
            "graded_at": ("DATETIME", insert_data["graded_at"]),
            "is_assigned": ("BOOL", insert_data["is_assigned"]),
            "preferences": ("JSON", insert_data["preferences"]),
            "prefers_evening": ("BOOL", insert_data["prefers_evening"])
        }
        
        await self.bq_client.run_query(query=insert_query, named_params=insert_params)
        return insert_data

    async def query_candidates(self, appointment_id, department_id, limit, prefers_evening=False, max_referral_date=None):
        params = {"appointment_id": ("STRING", appointment_id), "department_id": ("STRING", department_id), "limit": ("INTEGER", limit)}
        
        query = f"""
                SELECT
                    w.*
                FROM
                    {api.config.project.WAITLIST_FQTN} AS w
                LEFT JOIN
                    {api.config.project.REJECTED_APPOINTMENTS_FQTN} AS r
                    ON w.waitlist_id = r.waitlist_id AND r.appointment_id = @appointment_id
                WHERE
                    w.is_assigned IS FALSE
                    AND w.department_id = @department_id
                    AND r.waitlist_id IS NULL
                    AND NOT w.is_seen
                    AND w.deleted_at IS NULL"""
        
        if max_referral_date:
            query += " AND w.referral_date <= @max_referral_date"
            params["max_referral_date"] = ("DATETIME", max_referral_date.isoformat())
            
        query += f"""
                ORDER BY
                    w.prefers_evening {'DESC' if prefers_evening else 'ASC'},
                    w.clinical_urgency DESC,
                    w.condition_severity DESC,
                    w.comorbidities DESC,
                    w.referral_date ASC,
                    w.waitlist_id ASC
                LIMIT
                    @limit
                """
        
        return await self.bq_client.run_query(query=query, named_params=params)

    async def override_grade(self, waitlist_id: str, grade_override: GradeOverride):        
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)

        query = f"""
        UPDATE {api.config.project.WAITLIST_FQTN}
        SET 
            clinical_urgency = @clinical_urgency,
            condition_severity = @condition_severity,
            comorbidities = @comorbidities,
            edited_at = @current_time
        WHERE waitlist_id = @waitlist_id
        """
        
        parameters = {
            "waitlist_id": ("STRING", waitlist_id),
            "clinical_urgency": ("INTEGER", grade_override.clinical_urgency),
            "condition_severity": ("INTEGER", grade_override.condition_severity),
            "comorbidities": ("FLOAT", grade_override.comorbidities),
            "current_time": ("DATETIME", current_datetime)
        }
        
        await self.bq_client.run_query(query=query, named_params=parameters)
