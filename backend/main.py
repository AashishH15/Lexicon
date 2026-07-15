from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from languagetool import check_text, warm_up


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-launch the LanguageTool JVM on boot so the first user request
    # doesn't pay the multi-second cold-start cost. A failure here (e.g. the
    # JVM isn't installed) shouldn't crash the server; the first real request
    # will attempt to warm up again.
    warm_up()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GrammarRequest(BaseModel):
    text: str
    language: str = "en-US"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/grammar/check")
def grammar_check(request: GrammarRequest):
    matches = check_text(request.text, request.language)
    return {"matches": matches}
