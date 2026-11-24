"""Bounded public-reference tools for gaps in the reviewed experience corpus."""
import hashlib
import logging
import os
import ipaddress
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from html.parser import HTMLParser
from urllib.parse import urlparse, urlencode, urlunparse
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger(__name__)
AGENT = "PlacementPrepReferenceBot"
CATALOG = {
    "amazon": {
        "title": "Amazon interview preparation for software development",
        "url": "https://www.amazon.jobs/content/en-gb/how-we-hire/interview-prep/software-development-topics",
        "publisher": "Amazon Jobs", "category": "Employer guidance",
        "scope": "Amazon software-development guidance. Related technical preparation, not confirmation of the Machine Learning Engineer interview format.",
    },
    "microsoft": {
        "title": "Microsoft interview tips",
        "url": "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips.html",
        "publisher": "Microsoft Careers", "category": "Employer guidance",
        "scope": "Microsoft general interview guidance. Specific interview formats vary by role.",
    },
    "ml": {
        "title": "Machine Learning Interview Questions and Answers",
        "url": "https://www.geeksforgeeks.org/machine-learning/machine-learning-interview-questions/",
        "publisher": "GeeksforGeeks", "category": "Educational reference",
        "scope": "General machine-learning practice. Independent educational material, not an employer question list.",
    },
    "sql": {
        "title": "SQL Interview Questions",
        "url": "https://www.geeksforgeeks.org/sql/sql-interview-questions/",
        "publisher": "GeeksforGeeks", "category": "Educational reference",
        "scope": "General SQL practice. Independent educational material, not an employer question list.",
    },
    "dsa": {
        "title": "Commonly Asked Data Structure Interview Questions",
        "url": "https://www.geeksforgeeks.org/dsa/commonly-asked-data-structure-interview-questions-set-1/",
        "publisher": "GeeksforGeeks", "category": "Educational reference",
        "scope": "General data-structure practice. Independent educational material, not an employer question list.",
    },
}
ALLOWED_HOSTS = {urlparse(item["url"]).hostname for item in CATALOG.values()}

SEARCH_GROUPS = (
    ("LeetCode Discuss", ("leetcode.com",), "interview experience discuss"),
    ("GeeksforGeeks", ("geeksforgeeks.org",), "interview experience"),
    ("Glassdoor", ("glassdoor.com", "glassdoor.co.in"), "interview reviews questions"),
    ("AmbitionBox", ("ambitionbox.com",), "interview questions experience"),
    ("Reddit", ("reddit.com",), "interview experience (leetcode OR developersIndia)"),
    ("InterviewBit", ("interviewbit.com",), "interview experience questions"),
    ("Public engineering and candidate blogs", (), "engineering candidate blog interview experience"),
    ("Other public sources", (), "interview experience preparation rounds questions"),
)


def source_category(url, title, content, company):
    host = urlparse(url).hostname or ""
    employers = {"amazon": {"amazon.jobs", "www.amazon.jobs"},
                 "microsoft": {"careers.microsoft.com"}}
    if host in employers.get(company.strip().casefold(), set()):
        return "Employer guidance"
    text = (title + " " + content).casefold()
    reported = re.search(r"interview experience|interview review|candidate.{0,30}reported|my.{0,30}interview|i (?:was )?interviewed|on.campus|off.campus", text)
    community = any(host == domain or host.endswith("." + domain) for domain in ("reddit.com", "glassdoor.com", "glassdoor.co.in", "ambitionbox.com"))
    discussion = host.endswith("leetcode.com") and "/discuss" in urlparse(url).path
    if reported or ((community or discussion) and "interview" in text):
        return "Candidate/community report"
    return "Public web reference"


def prioritize_sources(sources):
    """Readable employer/candidate evidence precedes generic resources and search links."""
    priorities = {"Employer guidance": 0, "Candidate/community report": 1}
    return sorted(sources, key=lambda source: (not source.get("available", True), priorities.get(source.get("category"), 2)))


def public_result_url(url):
    """Validate links returned by search; arbitrary result URLs are never fetched by this app."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Unsupported search result URL")
    if not host or "." not in host or host.endswith((".local", ".localhost", ".internal", ".test")):
        raise ValueError("Non-public result URL")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("IP result URLs are unsupported")
    return urlunparse(parsed._replace(fragment=""))


@lru_cache(maxsize=128)
def search_platform_tool(company, role, query, group_index, cache_bucket):
    """Search one source family through Tavily, exposing indexed excerpts only."""
    publisher, domains, suffix = SEARCH_GROUPS[group_index]
    search_query = f'"{company}" {role} {query} {suffix}'[:1000]
    link = "https://www.google.com/search?" + urlencode({"q": search_query + (" site:" + domains[0] if domains else "")})
    unavailable = [{"title": f"Search {publisher}", "url": link, "publisher": publisher,
                    "category": "Platform search", "scope": "Search link only; no page content was retrieved.",
                    "excerpt": "", "available": False, "fetched_at": None}]
    key = os.getenv("TAVILY_API_KEY", "")
    if not key:
        return unavailable
    try:
        with httpx.Client(timeout=httpx.Timeout(8, connect=3)) as client:
            response = client.post("https://api.tavily.com/search", headers={"Authorization": "Bearer " + key},
                json={"query": search_query, "search_depth": "basic", "max_results": 2,
                      "include_domains": list(domains), "include_answer": False, "include_raw_content": False})
            response.raise_for_status()
            data = response.json()
        results = []
        company_tokens = set(re.findall(r"\w+", company.casefold()))
        for item in data.get("results", [])[:2]:
            try:
                url = public_result_url(item.get("url", ""))
                host = urlparse(url).hostname
                if domains and not any(host == d or host.endswith("." + d) for d in domains):
                    continue
            except (ValueError, TypeError):
                continue
            title, content = str(item.get("title", "")), str(item.get("content", ""))
            text_tokens = set(re.findall(r"\w+", (title + " " + content).casefold()))
            if not company_tokens or not company_tokens <= text_tokens or len(content.strip()) < 40:
                continue
            category = source_category(url, title, content, company)
            results.append({"title": title[:250] or host, "url": url, "publisher": publisher if domains else host,
                "category": category,
                "scope": "Search-index excerpt only; full page not read. Role and level may differ. Candidate reports are anecdotal, not employer-confirmed questions.",
                "excerpt": " ".join(content.split()[:160]), "available": True,
                "fetched_at": datetime.now(timezone.utc).isoformat()})
        return results or unavailable
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        log.info("Public platform search unavailable for %s", publisher)
        return unavailable


def search_public_platforms(company, role, query):
    bucket = int(time.time() // 600)
    with ThreadPoolExecutor(max_workers=4) as executor:
        groups = list(executor.map(lambda i: search_platform_tool(company, role, query, i, bucket), range(len(SEARCH_GROUPS))))
    # Keep one source per group before adding extras, so one platform cannot dominate.
    return [group[0] for group in groups if group] + [item for group in groups for item in group[1:]][:2]


def reference_catalog_tool(company, role, query):
    """Select known employer and educational pages using the requested context."""
    selected = []
    company_key = company.strip().casefold()
    if company_key in ("amazon", "microsoft"):
        selected.append(CATALOG[company_key])
    context = (role + " " + query).casefold()
    if any(term in context for term in ("machine learning", "data scientist", "artificial intelligence", " ml ", " ai ")):
        selected.append(CATALOG["ml"])
    if any(term in context for term in ("sql", "database", "data analyst", "data engineer")):
        selected.append(CATALOG["sql"])
    if not selected or len(selected) < 2 or any(term in context for term in ("coding", "algorithm", "software", "sde")):
        selected.append(CATALOG["dsa"])
    return selected[:3]


def checked_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Unsupported reference URL")
    return url


def read_page(client, url, limit):
    """Follow only allowlisted HTTPS redirects and cap response bytes."""
    for _ in range(4):
        checked_url(url)
        with client.stream("GET", url) as response:
            if response.is_redirect:
                url = str(response.url.join(response.headers["location"]))
                continue
            response.raise_for_status()
            mime = response.headers.get("content-type", "")
            if not any(kind in mime for kind in ("text/", "application/xhtml")):
                raise ValueError("Unsupported reference content")
            chunks = bytearray()
            for chunk in response.iter_bytes():
                chunks.extend(chunk)
                if len(chunks) > limit:
                    raise ValueError("Reference page exceeds limit")
            return chunks.decode("utf-8", errors="replace")
    raise ValueError("Too many reference redirects")


class PageText(HTMLParser):
    """Collect small visible prose blocks without scripts or navigation."""
    def __init__(self):
        super().__init__()
        self.stack = []
        self.blocks = []
        self.current = []
        self.preferred = []
        self.in_article = False
        self.found_heading = False

    def handle_starttag(self, tag, attrs):
        if tag not in {"br", "img", "meta", "link", "input", "hr", "source", "wbr"}:
            self.stack.append(tag)
        if tag in {"p", "li", "h1", "h2", "h3", "h4"}:
            self.flush()
        if tag == "h1" and not self.found_heading:
            self.blocks = []
            self.preferred = []
            self.found_heading = True
        if tag == "br":
            self.current.append(" ")

    def handle_endtag(self, tag):
        if tag in {"p", "li", "h1", "h2", "h3", "h4"}:
            self.flush()
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            del self.stack[index:]

    def handle_data(self, data):
        if not set(self.stack) & {"script", "style", "nav", "footer", "header", "noscript", "svg", "button"}:
            self.current.append(data)
            self.in_article = self.in_article or bool(set(self.stack) & {"main", "article"})

    def flush(self):
        block = " ".join(" ".join(self.current).split())
        if len(block) >= 20:
            self.blocks.append(block)
            if self.in_article:
                self.preferred.append(block)
        self.current = []
        self.in_article = False


@lru_cache(maxsize=64)
def fetch_reference_tool(url, cache_bucket):
    """Fetch a catalogued page if its published robot rules permit access."""
    checked_url(url)
    if url not in {item["url"] for item in CATALOG.values()}:
        raise ValueError("Reference URL is not in the catalog")
    try:
        with httpx.Client(timeout=httpx.Timeout(6, connect=3), headers={"User-Agent": AGENT}) as client:
            origin = urlparse(url)
            robots_url = f"{origin.scheme}://{origin.netloc}/robots.txt"
            rules = RobotFileParser()
            try:
                robots = read_page(client, robots_url, 100000)
            except httpx.HTTPStatusError as error:
                if error.response.status_code != 404:
                    return None
                robots = ""
            rules.parse(robots.splitlines())
            if not rules.can_fetch(AGENT, url):
                return None
            html = read_page(client, url, 2_000_000)
        parser = PageText()
        parser.feed(html)
        parser.flush()
        blocks = parser.preferred or parser.blocks
        if not blocks or not parser.found_heading:
            return None
        return {"blocks": list(dict.fromkeys(blocks))[:600],
                "fetched_at": datetime.now(timezone.utc).isoformat()}
    except (httpx.HTTPError, ValueError, KeyError):
        log.info("Public reference unavailable from %s", urlparse(url).hostname)
        return None


def public_references(company, role, query):
    """Return fetched excerpts plus explicit link-only entries when unavailable."""
    discovered = search_public_platforms(company, role, query)
    catalog = reference_catalog_tool(company, role, query)
    bucket = int(time.time() // 600)
    with ThreadPoolExecutor(max_workers=3) as executor:
        fetched = list(executor.map(lambda item: fetch_reference_tool(item["url"], bucket), catalog))
    tokens = set(re.findall(r"\w+", role.lower() + " " + query.lower())) - {"the", "and", "for", "questions", "engineer"}
    sources = []
    for item, page in zip(catalog, fetched, strict=True):
        excerpt = ""
        if page:
            blocks = sorted(enumerate(page["blocks"]),
                            key=lambda pair: (-len(tokens & set(re.findall(r"\w+", pair[1].lower()))), pair[0]))
            excerpt = " ".join(" ".join(block for _, block in blocks[:5]).split()[:180])
        sources.append({
            "id": "web-" + hashlib.sha256(item["url"].encode()).hexdigest()[:16],
            **item, "excerpt": excerpt, "sample": False, "kind": "web",
            "available": bool(excerpt), "fetched_at": page["fetched_at"] if page else None,
        })
    seen = {source["url"] for source in sources}
    for item in discovered:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        sources.append({"id": "web-" + hashlib.sha256(item["url"].encode()).hexdigest()[:16],
                        **item, "sample": False, "kind": "web"})
    return prioritize_sources(sources)
