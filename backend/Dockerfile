FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system utilities needed for playwright install-deps and pycairo
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    build-essential \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers and their OS dependencies
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy the rest of the backend code
COPY . .

# Run the web server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
