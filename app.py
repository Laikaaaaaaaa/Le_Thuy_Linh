import os
from pathlib import Path
from flask import Flask, abort, jsonify, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
IMAGES_BASE_DIR = BASE_DIR / "static" / "images_video"
MUSIC_BASE_DIR = BASE_DIR / "static" / "music"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".jfif", ".bmp", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
MUSIC_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"}

app = Flask(__name__, static_folder="static", static_url_path="/static")


def _sorted_files(path: Path):
    return sorted([item for item in path.iterdir() if item.is_file()], key=lambda item: item.name.lower())


@app.route("/api/media/<int:folder_index>")
def api_media(folder_index: int):
    folder_path = IMAGES_BASE_DIR / str(folder_index)
    if not folder_path.exists() or not folder_path.is_dir():
        return jsonify([])

    payload = []
    for file_path in _sorted_files(folder_path):
        ext = file_path.suffix.lower()
        if ext not in IMAGE_EXTENSIONS and ext not in VIDEO_EXTENSIONS:
            continue

        media_type = "video" if ext in VIDEO_EXTENSIONS else "image"
        payload.append(
            {
                "name": file_path.name,
                "type": media_type,
                "url": f"/static/images_video/{folder_index}/{file_path.name}",
            }
        )

    return jsonify(payload)


@app.route("/api/music")
def api_music():
    if not MUSIC_BASE_DIR.exists() or not MUSIC_BASE_DIR.is_dir():
        return jsonify([])

    payload = []
    for file_path in _sorted_files(MUSIC_BASE_DIR):
        ext = file_path.suffix.lower()
        if ext not in MUSIC_EXTENSIONS:
            continue

        payload.append(
            {
                "name": file_path.name,
                "url": f"/static/music/{file_path.name}",
            }
        )

    return jsonify(payload)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def root_files(filename: str):
    file_path = BASE_DIR / filename
    if not file_path.is_file():
        abort(404)
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
