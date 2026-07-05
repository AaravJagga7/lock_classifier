import pandas as pd
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from html.parser import HTMLParser
import httpx

from classify import classify

app = FastAPI()

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

class AnalysisRequest(BaseModel):
    logs: list[str]

class ScrapeRequest(BaseModel):
    url: str

class TableLogParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.logs = []
        self.current_row = {}
        self.current_tag = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "tr" and "class" in attrs_dict and "log-row" in attrs_dict["class"]:
            self.current_row = {"source": "", "message": ""}
        elif tag == "td":
            if "class" in attrs_dict:
                if "log-source" in attrs_dict["class"]:
                    self.current_tag = "source"
                elif "log-message" in attrs_dict["class"]:
                    self.current_tag = "message"

    def handle_data(self, data):
        if self.current_tag == "source":
            self.current_row["source"] += data
        elif self.current_tag == "message":
            self.current_row["message"] += data

    def handle_endtag(self, tag):
        if tag == "td":
            self.current_tag = None
        elif tag == "tr":
            if self.current_row.get("source") or self.current_row.get("message"):
                src = self.current_row.get("source", "").strip()
                msg = self.current_row.get("message", "").strip()
                if msg.startswith('"') and msg.endswith('"'):
                    msg = msg[1:-1]
                self.logs.append((src, msg))
                self.current_row = {}

@app.get("/")
async def serve_gui():
    return FileResponse("static/index.html")

@app.get("/mock-logs", response_class=HTMLResponse)
async def serve_mock_logs():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zoho Log Console - Live Log Stream</title>
    <style>
        body { background-color: #0f172a; color: #38bdf8; font-family: 'Courier New', monospace; padding: 2rem; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #f8fafc; font-size: 1.6rem; border-bottom: 2px solid #1e293b; padding-bottom: 0.75rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
        .meta { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5; }
        .meta code { background-color: #1e293b; color: #38bdf8; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.85rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
        th, td { text-align: left; padding: 0.85rem 1.25rem; border-bottom: 1px solid #1e293b; }
        th { background-color: #1e293b; color: #94a3b8; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
        .log-row { transition: background-color 0.2s ease; }
        .log-row:hover { background-color: rgba(56, 189, 248, 0.04); }
        .log-source { color: #38bdf8; font-weight: 600; font-size: 0.9rem; }
        .log-message { color: #e2e8f0; font-size: 0.9rem; }
        .status-pill { display: inline-flex; align-items: center; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; letter-spacing: 0.02em; text-transform: uppercase; }
        .status-ok { background-color: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-error { background-color: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }
    </style>
</head>
<body>
    <div class="container">
        <h1>📟 LIVE SYSTEM SERVICE LOG STREAM</h1>
        <div class="meta">
            <p>This diagnostic endpoint simulates live log telemetry broadcasts from internal systems. 
            You can enter this page URL (<code>http://127.0.0.1:8000/mock-logs</code>) into the Web Scraper panel of the Log Console to extract and ingest this dataset.</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Service Source</th>
                    <th>Raw Diagnostic Log Message</th>
                    <th>System Status</th>
                </tr>
            </thead>
            <tbody>
                <tr class="log-row">
                    <td class="log-source">ModernCRM</td>
                    <td class="log-message">IP 192.168.133.114 blocked due to potential attack</td>
                    <td><span class="status-pill status-error">BLOCKED</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">BillingSystem</td>
                    <td class="log-message">User 12345 logged in.</td>
                    <td><span class="status-pill status-ok">OK</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">AnalyticsEngine</td>
                    <td class="log-message">File data_6957.csv uploaded successfully by user User265.</td>
                    <td><span class="status-pill status-ok">OK</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">AnalyticsEngine</td>
                    <td class="log-message">Backup completed successfully.</td>
                    <td><span class="status-pill status-ok">OK</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">ModernHR</td>
                    <td class="log-message">GET /v2/54fadb412c4e40cdbaed9335e4c35a9e/servers/detail HTTP/1.1 RCODE  200 len: 1583 time: 0.1878400</td>
                    <td><span class="status-pill status-ok">OK</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">ModernHR</td>
                    <td class="log-message">Admin access escalation detected for user 9429</td>
                    <td><span class="status-pill status-error">ESCALATED</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">LegacyCRM</td>
                    <td class="log-message">Case escalation for ticket ID 7324 failed because the assigned support agent is no longer active.</td>
                    <td><span class="status-pill status-error">FAILED</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">LegacyCRM</td>
                    <td class="log-message">Invoice generation process aborted for order ID 8910 due to invalid tax calculation module.</td>
                    <td><span class="status-pill status-error">ABORTED</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">LegacyCRM</td>
                    <td class="log-message">The 'BulkEmailSender' feature is no longer supported. Use 'EmailCampaignManager' for improved functionality.</td>
                    <td><span class="status-pill status-error">DEPRECATED</span></td>
                </tr>
                <tr class="log-row">
                    <td class="log-source">LegacyCRM</td>
                    <td class="log-message">The 'ReportGenerator' module will be retired in version 4.0. Please migrate to the 'AdvancedAnalyticsSuite' by Dec 2025</td>
                    <td><span class="status-pill status-error">DEPRECATED</span></td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@app.post("/scrape/")
async def scrape_logs_from_url(request: ScrapeRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            response = await client.get(request.url, headers=headers, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Target web host returned status code {response.status_code}")
            
            html = response.text
            
            # Parse HTML
            parser = TableLogParser()
            parser.feed(html)
            
            if not parser.logs:
                raise HTTPException(status_code=400, detail="Web scraper failed: No logs matching class 'log-row' found at the target URL.")
            
            return {
                "logs": [{"source": src, "message": msg} for src, msg in parser.logs],
                "count": len(parser.logs),
                "message": f"Successfully scraped {len(parser.logs)} logs from URL."
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to target URL: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/")
async def analyze_errors(request: AnalysisRequest):
    if not request.logs:
        raise HTTPException(status_code=400, detail="Log list cannot be empty.")
    
    # Take unique logs up to 25 entries to avoid huge prompts
    unique_logs = list(set(request.logs))[:25]
    logs_summary = "\n".join([f"- {log}" for log in unique_logs])
    
    prompt = f"""You are an elite Site Reliability Engineer (SRE).
Analyze the following cluster of system log errors/warnings, identify the likely root cause(s), and provide clear, actionable remediation steps.

Here is the log data:
{logs_summary}

Please structure your response in clear, professional Markdown format. Include these specific sections:
1. ### Executive Summary
   A 2-3 sentence overview explaining what is failing and the high-level impact.
2. ### Probable Root Cause Analysis
   Analyze why these errors are occurring, highlighting specific sources or components.
3. ### Step-by-Step Remediation Plan
   Numbered, actionable instructions to resolve the problems (e.g., config changes, code adjustments, system restarts).
4. ### Severity & Criticality Assessment
   Rate the overall issue severity (Low, Medium, High, Critical) and justify the rating.
"""
    try:
        from processor_llm import groq
        chat_completion = groq.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.3
        )
        diagnosis = chat_completion.choices[0].message.content
        return {"diagnosis": diagnosis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/classify/")
async def classify_logs(file: UploadFile):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV.")
    
    try:
        # Read the uploaded CSV
        df = pd.read_csv(file.file)
        if "source" not in df.columns or "log_message" not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must contain 'source' and 'log_message' columns.")

        # Perform classification
        df["target_label"] = classify(list(zip(df["source"], df["log_message"])))

        print("Dataframe:",df.to_dict())

        # Save the modified file
        output_file = "resources/output.csv"
        df.to_csv(output_file, index=False)
        print("File saved to output.csv")
        return FileResponse(output_file, media_type='text/csv')
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        file.file.close()
        # # Clean up if the file was saved
        # if os.path.exists("output.csv"):
        #     os.remove("output.csv")