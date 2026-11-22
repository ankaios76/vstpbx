FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
        libfontconfig1 \
        libgdk-pixbuf-2.0-0 \
        libharfbuzz-icu0 \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY docs/requirements-admin-manual.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /workspace
ENTRYPOINT ["python", "tools/build_admin_manuals.py"]
