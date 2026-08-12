# /backend/main.py
"""Director AI FastAPI backend."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Video analysis request."""

    video_url: str = Field(min_length=10, max_length=2048)


class Scene(BaseModel):
    """Director-level analysis for one scene."""

    scene_title: str
    start_time: str
    end_time: str
    scene_summary: str
    visual_prompt: str
    camera_prompt: str
    lighting_prompt: str
    sound_design: str
    voice_over: str
    scene_recreation_prompt: str


class DirectorPackage(BaseModel):
    """Structured director prompt package."""

    title: str
    summary: str
    duration_seconds: int
    scenes: list[Scene]
    master_director_prompt: str


app = FastAPI(title="Director AI API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def is_public_youtube_url(value: str) -> bool:
    """Return whether the URL is a supported public YouTube URL shape."""

    try:
        parsed = urlparse(value)
    except ValueError:
        return False

    if parsed.scheme not in {"http", "https"}:
        return False

    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]

    return host in {"youtube.com", "youtu.be", "m.youtube.com"}


def clean_json_text(value: str) -> str:
    """Remove optional Markdown JSON fences from a model response."""

    text = value.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL)
    return fenced.group(1).strip() if fenced else text


def build_director_prompt() -> str:
    """Return the production prompt used for multimodal analysis."""

    return """
You are a senior film director, cinematographer, production designer,
sound designer and prompt engineer.

Analyze the supplied video using BOTH its visual and audio streams.

The product goal is to give a user an extremely detailed creative blueprint
that can later be pasted into ChatGPT and modified. Do not merely summarize.
Reconstruct the cinematic language as precisely as the available video evidence allows.

Rules:
1. First determine the approximate total video duration.
2. If the video is longer than 120 seconds, return valid JSON with:
   {"error":"VIDEO_TOO_LONG","duration_seconds":<integer>}
   and nothing else.
3. If the video is 120 seconds or shorter, divide it into meaningful scenes/shots.
4. Use MM:SS timestamps grounded in the video.
5. Describe only what is supported by the video. When an exact lens/focal length
   cannot be known, write "estimated" and give the visual equivalent.
6. Visual prompts must cover subject, wardrobe if visible, environment, props,
   action, composition, texture, depth, atmosphere and production design.
7. Camera prompts must cover shot size, angle, movement, framing, estimated lens feel,
   depth of field, focus behavior, camera height and movement speed.
8. Lighting prompts must cover key/fill/rim/practicals when inferable, direction,
   hardness, contrast, exposure mood, color temperature and color grade.
9. Sound design must cover ambience, effects, music character, rhythm, transitions
   and silence where relevant.
10. Voice-over: if the original contains narration/dialogue, describe performance
    and paraphrase the meaning rather than reproducing long copyrighted dialogue.
    If there is no VO, propose a short original VO that matches the scene.
11. Scene recreation prompts must be detailed, generation-ready prompts that preserve
    the video's structure without naming a living artist/director as a style shortcut.
12. The master prompt must synthesize the complete video's visual grammar, scene order,
    camera logic, lighting logic, sound arc, pacing and emotional intent.
13. Do not claim pixel-perfect reconstruction. Be precise about observable evidence.

Return ONLY strict JSON in exactly this shape:
{
  "title": "short inferred project title",
  "summary": "2-4 sentence high-level cinematic description",
  "duration_seconds": 0,
  "scenes": [
    {
      "scene_title": "short scene name",
      "start_time": "00:00",
      "end_time": "00:10",
      "scene_summary": "what happens",
      "visual_prompt": "detailed image/visual prompt",
      "camera_prompt": "detailed cinematography prompt",
      "lighting_prompt": "detailed lighting and color prompt",
      "sound_design": "detailed sound prompt",
      "voice_over": "VO performance and original/paraphrased line",
      "scene_recreation_prompt": "complete scene recreation prompt"
    }
  ],
  "master_director_prompt": "complete master recreation prompt"
}
""".strip()


def call_gemini(video_url: str) -> dict[str, Any]:
    """Analyze a public YouTube video with Gemini."""

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Server is missing GEMINI_API_KEY.",
        )

    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    client = genai.Client(api_key=api_key)

    try:
        interaction = client.interactions.create(
            model=model,
            input=[
                {"type": "video", "uri": video_url},
                {"type": "text", "text": build_director_prompt()},
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini could not analyze this video: {exc}",
        ) from exc

    output_text = getattr(interaction, "output_text", None)
    if not output_text:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty response.",
        )

    try:
        return json.loads(clean_json_text(output_text))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an invalid structured response. Please try again.",
        ) from exc


@app.get("/health")
def health() -> dict[str, str]:
    """Health check."""

    return {"status": "ok"}


@app.post("/api/analyze", response_model=DirectorPackage)
def analyze_video(request: AnalyzeRequest) -> DirectorPackage:
    """Create a director-level prompt package from a short public YouTube video."""

    video_url = request.video_url.strip()

    if not is_public_youtube_url(video_url):
        raise HTTPException(
            status_code=400,
            detail="V1 supports public YouTube URLs only.",
        )

    payload = call_gemini(video_url)

    if payload.get("error") == "VIDEO_TOO_LONG":
        duration = payload.get("duration_seconds", "unknown")
        raise HTTPException(
            status_code=400,
            detail=f"Video is {duration}s. V1 accepts videos up to 120 seconds.",
        )

    try:
        package = DirectorPackage.model_validate(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI response did not match the required director package format.",
        ) from exc

    if package.duration_seconds > 120:
        raise HTTPException(
            status_code=400,
            detail=f"Video is {package.duration_seconds}s. V1 accepts videos up to 120 seconds.",
        )

    if not package.scenes:
        raise HTTPException(
            status_code=502,
            detail="No scenes were detected. Try another public video.",
        )

    return package
