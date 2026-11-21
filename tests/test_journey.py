import io
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

TEST_DIR = tempfile.TemporaryDirectory()
os.environ["APP_MODE"] = "demo"
os.environ["DEMO_DATABASE_URL"] = "sqlite:///" + (Path(TEST_DIR.name) / "test.sqlite3").as_posix()

from backend import coach, main
from backend.db import Session, User


def request(client, method, path, status=200, **kwargs):
    response = client.request(method, "/api" + path, **kwargs)
    assert response.status_code == status, response.text
    return response.json() if response.content else None


def account(client, name, role="student"):
    return request(client, "POST", "/auth/register", 201, json={
        "email": f"{name}@example.test", "name": name, "password": "demo-password", "role": role,
    })


def resume_pdf():
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 72 720 Td (Skills: Python and SQL) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_student_journey():
    with TestClient(main.app) as client:
        student = account(client, "student")
        request(client, "POST", "/job-descriptions", json={
            "company": "Amazon", "role": "Software Development Engineer",
            "description": "Required: Python, SQL, Trees\nPreferred: Git",
        })
        request(client, "POST", "/resumes", 422, files={"file": ("invalid.pdf", b"not a pdf")})
        resume = request(client, "POST", "/resumes", files={"file": ("resume.pdf", resume_pdf(), "application/pdf")})
        assert {"Python", "SQL"} <= set(resume["skills"])
        gaps = request(client, "POST", "/preparation/analyze")
        assert {row["topic"]: row["status"] for row in gaps} == {
            "Trees": "unverified", "Python": "evidenced", "SQL": "evidenced", "Git": "unverified",
        }
        assert request(client, "GET", "/reports/latest")["score"] is None
        request(client, "POST", "/assessments/coding-sql/submit", 201, json={"language": "Python", "answer": "pass"})
        assert next(gap for gap in request(client, "GET", "/skill-gaps") if gap["topic"] == "SQL")["status"] == "weak"
        aptitude = request(client, "GET", "/assessments")["aptitude"]
        assert all("correct_choice" not in row for row in aptitude)
        scored = request(client, "POST", "/assessments/aptitude/submit", 201,
                         json={"answers": {"q1": 1, "q2": 1, "q3": 2, "q4": 3, "q5": 0, "q6": 1}})
        assert scored["score"] == 100
        request(client, "POST", "/assessments/communication/submit", 201,
                json={"answer": "Our team planned the work. My task was to check the result. We measured improvement."})
        interview = request(client, "POST", "/interviews", 201)
        interview_id = interview["id"]
        for i in range(5):
            payload = {"question_id": interview["question"]["id"], "answer": "Unsure."}
            interview = request(client, "POST", f"/interviews/{interview_id}/answer", json=payload)
            assert len(interview["turns"]) == i + 1
            assert request(client, "POST", f"/interviews/{interview_id}/answer", json=payload) == interview
            if i == 0:
                assert interview["question"]["difficulty"] == "easy"
        assert interview["score"] is not None
        report = request(client, "GET", "/reports/latest")
        assert report["coverage"] == 5
        assert report["score"] == round(sum(item["score"] * item["weight"] for item in report["components"]) / 100, 2)
        roadmap = request(client, "POST", "/roadmaps/current")
        assert set(task["week"] for task in roadmap["tasks"]) == {1, 2, 3, 4}
        task_id = next(task["id"] for task in roadmap["tasks"] if task["topic"] == "SQL")
        request(client, "PATCH", "/roadmaps/current/tasks/" + task_id, json={"completed": True})
        assert next(task for task in request(client, "POST", "/roadmaps/current")["tasks"] if task["id"] == task_id)["completed"]
        token = client.cookies[main.COOKIE]

    with TestClient(main.app) as restarted:
        restarted.cookies.set(main.COOKIE, token)
        assert request(restarted, "GET", "/profile")["id"] == student["id"]
        assert request(restarted, "GET", f"/interviews/{interview_id}")["score"] == interview["score"]
        assert next(task for task in request(restarted, "GET", "/roadmaps/current")["tasks"] if task["id"] == task_id)["completed"]
        restarted.cookies.clear()
        account(restarted, "another-student")
        request(restarted, "POST", "/job-descriptions", json={
            "company": "Amazon", "role": "Software Development Engineer", "description": "Required: Python",
        })
        request(restarted, "GET", f"/interviews/{interview_id}", 404)
        request(restarted, "POST", "/auth/logout", 204)
        request(restarted, "GET", "/profile", 401)


def test_moderation_retrieval_and_failed_approval(monkeypatch):
    query = {"company": "Example Labs", "role": "Backend Engineer", "q": "relational SQL joins"}
    experience = {
        "company": query["company"], "role": query["role"], "title": "Backend hiring",
        "process": "A discussion about relational SQL joins and query optimization.",
        "rounds": ["Technical"], "questions": ["Explain SQL joins."], "topics": ["SQL"], "difficulty": "medium",
    }
    with TestClient(main.app) as senior, TestClient(main.app) as student, TestClient(main.app) as moderator:
        account(senior, "senior", "senior")
        account(student, "searcher")
        with Session.begin() as db:
            db.add(User(email="mod@example.test", name="Moderator", role="moderator", password=main.PASSWORDS.hash("demo-password")))
        request(moderator, "POST", "/auth/login", json={"email": "mod@example.test", "password": "demo-password"})
        request(student, "POST", "/experiences", 403, json=experience)
        entry = request(senior, "POST", "/experiences", 201, json=experience)
        url = "/experiences/" + entry["id"]
        request(senior, "PATCH", url + "/review", 403, json={"status": "approved"})
        assert request(student, "GET", "/experiences/search", params=query)["sources"] == []
        request(student, "GET", url, 404)
        with monkeypatch.context() as helper:
            def unavailable(_texts):
                raise main.HTTPException(503, "Embedding unavailable")
            helper.setattr(coach, "embed", unavailable)
            request(moderator, "PATCH", url + "/review", 503, json={"status": "approved"})
        assert request(moderator, "GET", url)["status"] == "pending"
        request(moderator, "PATCH", url + "/review", json={"status": "approved"})
        search = request(student, "GET", "/experiences/search", params=query)
        assert search["citations"] == [1]
        assert search["sources"][0]["id"] == entry["id"]
        assert request(student, "GET", url)["status"] == "approved"
        assert not request(student, "GET", "/experiences/search", params={**query, "role": "Accountant"})["sources"]
        request(student, "POST", "/job-descriptions", json={
            "company": query["company"], "role": query["role"], "description": "Required: SQL",
        })
        interview = request(student, "POST", "/interviews", 201)
        assert interview["question"]["sources"][0]["id"] == entry["id"]
        entry = request(senior, "POST", "/experiences", 201, json=experience)
        request(moderator, "PATCH", f"/experiences/{entry['id']}/review", json={"status": "rejected"})
        request(student, "GET", f"/experiences/{entry['id']}", 404)


def test_provider_output_validation(monkeypatch):
    class BrokenModel:
        def with_structured_output(self, _schema, *, method, strict):
            assert method == "json_schema"
            assert strict is True
            return self

        def invoke(self, _messages):
            return {"score": 501}

    monkeypatch.setattr(coach, "DEMO", False)
    monkeypatch.setattr(coach, "model", lambda: BrokenModel())
    with pytest.raises(main.HTTPException, match="temporarily unavailable"):
        coach.feedback("coding", {"answer": "return 1"})

def test_concurrent_interview_submissions(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    rendezvous = Barrier(2)
    original = main.run

    def synchronized(operation, payload):
        if operation == "interview":
            rendezvous.wait(timeout=10)
        return original(operation, payload)

    monkeypatch.setattr(main, "run", synchronized)
    with TestClient(main.app) as client:
        account(client, "concurrent")
        request(client, "POST", "/job-descriptions", json={
            "company": "Amazon", "role": "Software Development Engineer", "description": "Required: SQL",
        })
        interview = request(client, "POST", "/interviews", 201)
        path = "/api/interviews/" + interview["id"] + "/answer"
        token = client.cookies[main.COOKIE]

        def submit(answer):
            with TestClient(main.app) as other:
                other.cookies.set(main.COOKIE, token)
                return other.post(path, json={"question_id": interview["question"]["id"], "answer": answer})

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(submit, ["One answer.", "A different answer."]))
        assert sorted(response.status_code for response in responses) == [200, 409]
        assert len(request(client, "GET", "/interviews/" + interview["id"])["turns"]) == 1


def test_dynamic_tests_and_administrator_review():
    with TestClient(main.app) as client:
        account(client, "dynamic-tests")
        request(client, "POST", "/job-descriptions", json={
            "company": "Example", "role": "Engineer", "description": "Required: Java and SQL",
        })
        for kind, count in [("coding", 10), ("aptitude", 15), ("communication", 10)]:
            test = request(client, "POST", "/tests", 201, json={"kind": kind, "count": count, "language": "Java"})
            assert len(test["questions"]) == count
            assert all("correct" not in q for q in test["questions"])
            for question in test["questions"]:
                payload = {"answers": {question["id"]: 2}} if kind == "aptitude" else {"answer": "An example with reasoning and a clear result.", "language": "Java"}
                path = f"/tests/{test['id']}/questions/{question['id']}/submit"
                response = request(client, "POST", path, json=payload)
                assert request(client, "POST", path, json=payload) == response
            assert response["complete"]
        assert len(request(client, "GET", "/assessments/history")) == 3
        request(client, "POST", "/tests", 422, json={"kind": "coding", "count": 51})
        request(client, "POST", "/auth/logout", 204)
        account(client, "dynamic-senior", "senior")
        entry = request(client, "POST", "/experiences", 201, json={
            "company": "Example", "role": "Engineer", "title": "Interview",
            "process": "Technical rounds with SQL and Java", "rounds": ["Technical"],
            "questions": ["Explain a SQL join"], "topics": ["SQL"], "difficulty": "medium",
        })
        with Session.begin() as db:
            db.add(User(email="administrator-test@example.test", name="Administrator",
                        role="administrator", password=main.PASSWORDS.hash("demo-password")))
        request(client, "POST", "/auth/login", json={"email": "administrator-test@example.test", "password": "demo-password"})
        assert any(row["id"] == entry["id"] for row in request(client, "GET", "/experiences"))
        request(client, "PATCH", f"/experiences/{entry['id']}/review", json={"status": "approved"})
