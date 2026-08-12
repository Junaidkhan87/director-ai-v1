# /main.py
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

    video_url: str = Field(
        min_length=10,
        max_length=2048,
    )


class Scene(BaseModel):
    """Director-level analysis for one timeframe."""

    scene_title: str
    start_time: str
    end_time: str
    detailed_image_prompt: str
    detailed_visual_direction: str
    camera_direction: str
    lighting_direction: str
    sound_direction: str
    voice_over_direction: str
    scene_recreation_prompt: str


class DirectorPackage(BaseModel):
    """Structured director prompt package."""

    title: str
    summary: str
    duration_seconds: int
    scenes: list[Scene]
    master_director_prompt: str


app = FastAPI(
    title="Director AI API",
    version="2.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "*",
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
    """Return whether the URL is a supported public YouTube URL."""

    try:
        parsed = urlparse(value)
    except ValueError:
        return False

    if parsed.scheme not in {"http", "https"}:
        return False

    host = (parsed.hostname or "").lower()

    if host.startswith("www."):
        host = host[4:]

    return host in {
        "youtube.com",
        "youtu.be",
        "m.youtube.com",
    }


def clean_json_text(value: str) -> str:
    """Remove optional Markdown JSON fences."""

    text = value.strip()

    fenced = re.fullmatch(
        r"```(?:json)?\s*(.*?)\s*```",
        text,
        flags=re.DOTALL,
    )

    return fenced.group(1).strip() if fenced else text


def build_director_prompt() -> str:
    """Return the multimodal production-analysis prompt."""

    return """
You are a senior film director, cinematographer, production designer,
storyboard artist, sound designer and expert prompt engineer.

Analyze the supplied video using BOTH the visual stream and audio stream.

The output will be used as a highly detailed creative blueprint that a user
can later paste into ChatGPT and modify. Do not write a short summary.
Extract the video's cinematic construction scene by scene.

VIDEO LIMIT
1. Determine the approximate total video duration first.
2. If the video is longer than 120 seconds, return ONLY:
   {"error":"VIDEO_TOO_LONG","duration_seconds":<integer>}
3. Otherwise continue.

SCENE / TIMEFRAME RULES
4. Divide the video into meaningful timeframes based on actual changes in
   shot, action, location, visual objective, camera setup or narrative beat.
5. Use grounded MM:SS start and end timestamps.
6. Do not combine visibly different shots merely to reduce scene count.
7. For very short shots, group only when they clearly form one continuous
   montage beat.

FOR EACH TIMEFRAME, WRITE IN THIS ORDER

A. DETAILED IMAGE PROMPT
Create a production-ready still-image prompt representing the most important
frame or visual identity of that timeframe. Include:
- subject count and appearance
- approximate age range when visually inferable
- facial expression and pose
- wardrobe, materials and colors
- environment and background
- foreground and background objects
- props
- exact action
- composition and subject placement
- depth layers
- surface texture
- weather / atmosphere
- time of day
- realism or animation type
- image aspect/compositional feel
- visible text only when necessary
Never invent details that contradict the video.

B. DETAILED VISUAL DIRECTION
Describe what visually happens throughout the timeframe in chronological order.
Include movement of people/objects, entrances/exits, environmental changes,
screen direction, composition changes, visual emphasis, transitions and pacing.
This must be more detailed than the image prompt because it describes the
moving sequence rather than one still frame.

C. CAMERA & LENS
Include:
- shot size
- camera angle and height
- camera position relative to subject
- framing
- camera movement
- movement speed
- estimated focal-length/lens feel
- depth of field
- focus behavior / rack focus when visible
- stabilization / handheld quality
- zoom/dolly/pan/tilt/orbit/tracking when visible
If exact focal length is unknowable, explicitly say "estimated".

D. LIGHTING & COLOR
Include:
- key light direction
- fill level
- rim/backlight when visible
- practical lights
- softness/hardness
- contrast
- shadow character
- exposure mood
- color temperature
- dominant palette
- highlight/shadow hue
- color grade
- atmospheric lighting

E. SOUND DESIGN
Analyze:
- ambience
- sound effects
- Foley
- music style
- rhythm
- intensity
- transitions
- silence
- spatial character
- synchronization with visual beats

F. VOICE OVER / DIALOGUE DIRECTION
If narration/dialogue exists:
- describe speaker type and performance
- tone, pace, emotion and delivery
- paraphrase the meaning rather than reproducing long copyrighted dialogue
If no voice exists:
- say "No original voice-over detected"
- optionally suggest one short original line only when it helps recreation

G. SCENE RECREATION PROMPT
Combine the full timeframe into one generation-ready director prompt containing
the precise visual sequence, camera logic, lighting, sound and VO direction.

MASTER PROMPT
After all timeframes, write one master recreation prompt that preserves:
- complete scene order
- pacing
- recurring character/visual continuity
- cinematography language
- lighting/color progression
- sound arc
- narrative/emotional intent
- transitions
- overall production design

ACCURACY RULES
- Describe only what video evidence supports.
- Never claim pixel-perfect reconstruction.
- Do not use living artist/director names as style shortcuts.
- Do not output analysis prose outside the JSON.
- Be detailed enough that each timeframe can be independently recreated.

Return ONLY strict JSON in exactly this shape:

{
  "title": "short inferred project title",
  "summary": "2-4 sentence high-level cinematic description",
  "duration_seconds": 0,
  "scenes": [
    {
      "scene_title": "short timeframe name",
      "start_time": "00:00",
      "end_time": "00:08",
      "detailed_image_prompt": "very detailed still-image prompt",
      "detailed_visual_direction": "chronological moving visual description",
      "camera_direction": "detailed cinematography and lens direction",
      "lighting_direction": "detailed lighting and color direction",
      "sound_direction": "detailed sound design",
      "voice_over_direction": "voice/dialogue performance and paraphrased content",
      "scene_recreation_prompt": "complete generation-ready timeframe prompt"
    }
  ],
  "master_director_prompt": "complete video recreation prompt"
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

    model = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.6-flash",
    )

    client = genai.Client(api_key=api_key)

    try:
        interaction = client.interactions.create(
            model=model,
            input=[
                {
                    "type": "video",
                    "uri": video_url,
                },
                {
                    "type": "text",
                    "text": build_director_prompt(),
                },
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini could not analyze this video: {exc}",
        ) from exc

    output_text = getattr(
        interaction,
        "output_text",
        None,
    )

    if not output_text:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty response.",
        )

    try:
        return json.loads(
            clean_json_text(output_text)
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned an invalid structured response. "
                "Please try again."
            ),
        ) from exc


@app.get("/health")
def health() -> dict[str, str]:
    """Return service health."""

    return {"status": "ok"}


@app.post(
    "/api/analyze",
    response_model=DirectorPackage,
)
def analyze_video(
    request: AnalyzeRequest,
) -> DirectorPackage:
    """Create a detailed director package for a short video."""

    video_url = request.video_url.strip()

    if not is_public_youtube_url(video_url):
        raise HTTPException(
            status_code=400,
            detail=(
                "V1 supports public YouTube URLs only."
            ),
        )

    payload = call_gemini(video_url)

    if payload.get("error") == "VIDEO_TOO_LONG":
        duration = payload.get(
            "duration_seconds",
            "unknown",
        )

        raise HTTPException(
            status_code=400,
            detail=(
                f"Video is {duration}s. "
                "This version accepts videos up to 120 seconds."
            ),
        )

    try:
        package = DirectorPackage.model_validate(
            payload
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "AI response did not match the required "
                "director package format."
            ),
        ) from exc

    if package.duration_seconds > 120:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Video is {package.duration_seconds}s. "
                "This version accepts videos up to 120 seconds."
            ),
        )

    if not package.scenes:
        raise HTTPException(
            status_code=502,
            detail=(
                "No scenes were detected. "
                "Try another public video."
            ),
        )

    return package
