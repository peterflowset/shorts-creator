#!/usr/bin/env python3
"""Upload a Short video to YouTube as a private draft.

Usage:
    python3 upload_youtube.py <video_path> <description_path>

The description file format (short_N_description.txt):
    Line 1: Title
    Line 2: (blank)
    Line 3+: Description body
    Last line: #hashtags separated by spaces

Requires:
    - credentials.json (OAuth Client ID from Google Cloud Console) in the same directory
    - YouTube Data API v3 enabled in Google Cloud Console
    - First run opens a browser for OAuth consent (generates token.json)
"""

import argparse
import os
import re
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube"]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(SCRIPT_DIR, "credentials.json")
TOKEN_FILE = os.path.join(SCRIPT_DIR, "token.json")


def get_authenticated_service():
    """Authenticate and return a YouTube API service object."""
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(
                    f"ERROR: {CREDENTIALS_FILE} not found.\n"
                    "Download it from Google Cloud Console "
                    "(APIs & Services > Credentials > OAuth 2.0 Client ID).",
                    file=sys.stderr,
                )
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def parse_description_file(description_path):
    """Parse a short_N_description.txt file into title, description, and tags."""
    with open(description_path, "r", encoding="utf-8") as f:
        content = f.read().strip()

    lines = content.split("\n")
    title = lines[0].strip()

    # Find hashtag line (last non-empty line starting with #)
    body_lines = []
    tags = []
    for line in lines[1:]:
        stripped = line.strip()
        if stripped and stripped.startswith("#") and " #" in stripped:
            # This is the hashtag line
            tags = [tag.lstrip("#") for tag in re.findall(r"#\w+", stripped)]
        else:
            body_lines.append(line)

    description = "\n".join(body_lines).strip()

    return title, description, tags


def upload_video(youtube, video_path, title, description, tags):
    """Upload a video to YouTube as a private draft."""
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "22",  # People & Blogs
        },
        "status": {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(video_path, mimetype="video/mp4", resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    print(f"Uploading: {os.path.basename(video_path)}")
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  Progress: {int(status.progress() * 100)}%")

    video_id = response["id"]
    print(f"Upload complete: https://youtu.be/{video_id}")
    return video_id


def main():
    parser = argparse.ArgumentParser(description="Upload a Short to YouTube as private draft")
    parser.add_argument("video_path", help="Path to the short video .mp4 file")
    parser.add_argument("description_path", help="Path to the description .txt file")
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"ERROR: Video not found: {args.video_path}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.description_path):
        print(f"ERROR: Description not found: {args.description_path}", file=sys.stderr)
        sys.exit(1)

    title, description, tags = parse_description_file(args.description_path)
    print(f"Title: {title}")
    print(f"Tags: {tags}")

    youtube = get_authenticated_service()
    upload_video(youtube, args.video_path, title, description, tags)


if __name__ == "__main__":
    main()
