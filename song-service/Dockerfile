FROM python:3.11-slim AS builder

# Deno is used by yt-dlp to solve YouTube's JS challenges.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && /usr/local/bin/deno --version \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a virtualenv that the final stage copies.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/deno /usr/local/bin/deno
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy application code
COPY *.py ./

# Create directories for songs
RUN mkdir -p songs/audio songs/lyrics

# Expose Flask port
EXPOSE 5001

# Run Flask server
CMD ["python3", "app.py"]
