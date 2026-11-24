# An Intelligent AI Platform for Personalized Placement Preparation

An Intelligent AI Platform for Personalized Placement Preparation brings resume and job-description analysis, skill gaps, coding practice, aptitude tests, written communication, and adaptive mock interviews into one preparation workspace. Approved senior interview experiences feed company- and role-specific retrieval. Assessments inform a four-week roadmap and a weighted readiness report.

## Local demo

Use Python 3.12+ and Node.js 22.12+. The demo creates its SQLite database on first launch. It uses deterministic extraction and scoring, a local token-vector search, and a labeled sample Amazon interview experience.

In PowerShell, from the project folder:

```powershell
python -m venv .venv
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
& ./.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

If your Windows host blocks native Python wheels, build the frontend with PowerShell as above and run the backend from WSL:

```bash
cd /mnt/c/Intelligent-AI-Platform
python3 -m venv ~/.venvs/placement-studio
~/.venvs/placement-studio/bin/python -m pip install -r requirements.txt
~/.venvs/placement-studio/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open [An Intelligent AI Platform for Personalized Placement Preparation](http://localhost:8000/) or [FastAPI interactive docs](http://localhost:8000/docs). For frontend editing, run `npm.cmd --prefix frontend run dev` with FastAPI running on port 8000 and open [Vite](http://localhost:5173/).

### Demo walkthrough

1. Register as a student. Upload a text-based PDF with a Skills section and save a target for **Amazon** and **Software Development Engineer**. Use a description such as `Required: Python, SQL, Trees` and `Preferred: Git` on separate lines.
2. Review the skill gaps. Submit a short attempt for **Group Order Totals** to see weak SQL evidence. Complete aptitude and communication and answer five mock interview questions.
3. Search interview experiences for `SQL joins` using the same company and role. Open the cited experience. Generate a roadmap, complete a task, and open the readiness report.
4. Register as a senior in a separate browser profile, submit an experience, and confirm its pending status. Create a moderator with the command below. Sign in as that moderator, approve the experience, then search as the student using the matching company and role.

```powershell
& ./.venv/Scripts/python.exe -m backend.cli create-moderator --email moderator@example.test --name Moderator
```

The readiness report uses the latest assessment in each category and the latest completed interview for the current target. It shows an overall score after all five components are available. Coding review is static and written communication assesses the submitted text. Scanned PDF OCR and voice assessment are outside this release.

## Start live mode on Windows

With the frontend built, the live requirements installed in the WSL virtual environment, and the Neon schema migrated, run `./start-live.ps1` from PowerShell. It starts the app on http://localhost:8000 and resolves the Neon hostname per launch. For this local configuration use `APP_ORIGIN=http://localhost:8000`. To run the credential-free demo with a live `.env` present, prefix the Linux launch command with `APP_MODE=demo`.

## Live configuration and deployment

Copy `.env.example` to `.env`, set `APP_MODE=live`, and supply:

| Setting | Value |
| --- | --- |
| `APP_ORIGIN` | The exact HTTPS origin serving the frontend and API |
| `DATABASE_URL` | A Neon PostgreSQL connection string with TLS enabled |
| `NVIDIA_API_KEY` | A server-side NVIDIA API key |
| `NVIDIA_MODEL` | An available NVIDIA chat model with structured output support |

Use a Neon role with permission to enable pgvector and run migrations. Live mode sends text needed for model requests to NVIDIA and uses a local sentence-transformers model to embed experience text and search queries. Configure network access for the first embedding model download or provision its cache before launch. Keep the database, resume data, and credentials private.

```bash
docker build -t placement-studio .
docker run --rm --env-file .env placement-studio python -m alembic upgrade head
docker run --rm -it --env-file .env placement-studio python -m backend.cli create-moderator --email moderator@example.com --name Moderator
docker run -d --name placement-studio --env-file .env -p 127.0.0.1:8000:8000 placement-studio
```

Point your HTTPS reverse proxy at the container. Use `GET /api/health` for database-backed health checks. Apply Alembic migrations before starting new application instances, and back up the database before schema changes. Review moderation and retention practices for the intended deployment. A demo-only image can use `--build-arg INSTALL_LIVE=false` and a writable persistent volume at `/data` for SQLite.

## Verification

```powershell
& ./.venv/Scripts/python.exe -m pytest -q
npm.cmd --prefix frontend run build
```

The integration tests use a temporary SQLite database. Dynamic tests generate questions in batches of five and validate the complete set before saving it. Students choose 1–50 questions and a coding language. Completed attempts contribute one aggregate assessment per test; retrying an answered question returns its saved result. Administrators review pending experiences. Create an administrator from PowerShell with ./start-live.ps1 -CreateAdministrator -Email admin@example.com. The database layer resolves Neon through DNS over HTTPS when local DNS fails, so CLI commands and the app share the same recovery behavior. They cover text extraction, skill evidence, objective scoring, assessment feedback, interview adaptation and duplicate submissions, persisted roadmap progress, account isolation, experience approval and rollback, retrieval, and invalid model responses. Test PostgreSQL migrations and retrieval against a dedicated database before deploying.


## License

This project is licensed under the [MIT License](LICENSE).

## Public preparation references

When approved senior experiences do not match a student's search, the LangGraph public-reference node selects pages from a maintained catalog. It supports Amazon and Microsoft employer guidance plus GeeksforGeeks machine-learning, SQL, and data-structure preparation resources. Employer pages retain their stated scope. GeeksforGeeks is labeled as independent educational material.

The tools fetch bounded HTTPS pages, respect published robot rules, exclude scripts and navigation, cache results for ten minutes, and return short source excerpts with links and retrieval dates. Blocked or unavailable pages appear as links only and are excluded from answer evidence. External content is used for student guidance and is not inserted into the approved senior experience corpus. This capability needs no additional API key. It searches the maintained resource catalog rather than the entire web.
