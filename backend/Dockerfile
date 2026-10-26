FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

RUN groupadd --system app && useradd --system --gid app --home-dir /app app
USER app

EXPOSE 8000
CMD ["uvicorn", "seap_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
