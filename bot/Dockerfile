# The booking bot: one long-running process, no HTTP surface, no build step.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    BOT_STATE_FILE=/data/state.json

WORKDIR /app

# Dependencies first: this layer is cached until requirements.txt itself changes,
# so editing a handler rebuilds in seconds rather than re-resolving pip.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY assets ./assets

# The client→topic mapping must outlive the container. Declared as a volume so
# `docker run` without `-v` still keeps it out of the writable image layer —
# and so forgetting the mount is visible rather than silent.
RUN useradd --system --uid 10001 bot \
    && mkdir -p /data \
    && chown bot:bot /data
VOLUME ["/data"]
USER bot

# No healthcheck: the bot has no port to probe. Long polling either runs or the
# process exits, so the restart policy is the liveness mechanism.
CMD ["python", "-m", "app"]
