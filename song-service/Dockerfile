FROM python:3.11-slim

# Install system dependencies (keep this minimal for faster builds)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./

# Create directories for songs
RUN mkdir -p songs/audio songs/lyrics

# Expose Flask port
EXPOSE 5001

# Run Flask server
CMD ["python3", "app.py"]
